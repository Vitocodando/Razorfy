import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { localDateString, localDayRangeUtc, isoWeekday } from '../schedule/availability.service';

// FEAT-081: BFF de Analytics financeiro. Uma chamada → 3 datasets para os gráficos.
export const ANALYTICS_RANGES = ['LAST_7_DAYS', 'LAST_14_DAYS', 'CURRENT_MONTH'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const DAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

const MS_DAY = 24 * 60 * 60 * 1000;

// Lista de dias (YYYY-MM-DD no fuso do negócio) do intervalo, inclusivo até hoje.
function buildDays(range: AnalyticsRange): string[] {
  const today = localDateString(new Date());
  let firstDay: string;
  if (range === 'CURRENT_MONTH') {
    firstDay = today.slice(0, 7) + '-01'; // RN03: 1º dia do mês corrente
  } else {
    const n = range === 'LAST_7_DAYS' ? 7 : 14;
    firstDay = localDateString(new Date(localDayRangeUtc(today).dayStartUtc.getTime() - (n - 1) * MS_DAY));
  }
  const days: string[] = [];
  let cursor = localDayRangeUtc(firstDay).dayStartUtc.getTime();
  let label = localDateString(new Date(cursor));
  while (label <= today) {
    days.push(label);
    cursor += MS_DAY;
    label = localDateString(new Date(cursor));
  }
  return days;
}

function num(d: Prisma.Decimal): number {
  return Number(d.toDecimalPlaces(2));
}

export async function getAnalytics(tenantId: string, rangeRaw: string) {
  // V01: enum estrito.
  if (!ANALYTICS_RANGES.includes(rangeRaw as AnalyticsRange)) {
    throw new BusinessError('INVALID_ANALYTICS_RANGE', 'Filtro de tempo inválido. Escolha entre 7 dias, 14 dias ou Mês Atual.', 400);
  }
  const range = rangeRaw as AnalyticsRange;
  const days = buildDays(range);
  const fromUtc = localDayRangeUtc(days[0]).dayStartUtc;
  const toUtc = localDayRangeUtc(days[days.length - 1]).dayEndUtc;

  // RN01: apenas CONCLUDED; tenant isolado.
  const appts = await prisma.appointment.findMany({
    where: { tenantId, status: 'CONCLUDED', startTimestamp: { gte: fromUtc, lt: toUtc } },
    select: {
      amountPaid: true,
      startTimestamp: true,
      barberId: true,
      barber: { select: { name: true, isActive: true } },
    },
  });

  const zero = () => new Prisma.Decimal(0);
  const byDay = new Map<string, Prisma.Decimal>();
  const byDow = new Map<number, Prisma.Decimal>();
  const byBarber = new Map<string, { name: string; isActive: boolean; revenue: Prisma.Decimal }>();

  for (const a of appts) {
    const day = localDateString(a.startTimestamp);
    byDay.set(day, (byDay.get(day) ?? zero()).plus(a.amountPaid));
    const dow = isoWeekday(day);
    byDow.set(dow, (byDow.get(dow) ?? zero()).plus(a.amountPaid));
    const cur = byBarber.get(a.barberId) ?? { name: a.barber.name, isActive: a.barber.isActive, revenue: zero() };
    cur.revenue = cur.revenue.plus(a.amountPaid);
    byBarber.set(a.barberId, cur);
  }

  // RN02: gap filling — todo dia do intervalo tem um nó (0.00 se vazio).
  const generalTimeline = days.map(d => ({
    date: d,
    formattedDate: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
    revenue: num(byDay.get(d) ?? zero()),
  }));

  // RN04: barbeiro inativo com histórico aparece com "(Inativo)".
  const barberBreakdown = [...byBarber.entries()]
    .map(([barberId, v]) => ({ barberId, barberName: v.isActive ? v.name : `${v.name} (Inativo)`, revenue: num(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  // V02: sempre 7 itens, ordenados 1..7.
  const dayOfWeekBreakdown = [1, 2, 3, 4, 5, 6, 7].map(i => ({
    dayIndex: i,
    dayName: DAY_NAMES[i - 1],
    revenue: num(byDow.get(i) ?? zero()),
  }));

  return { range, generalTimeline, barberBreakdown, dayOfWeekBreakdown };
}
