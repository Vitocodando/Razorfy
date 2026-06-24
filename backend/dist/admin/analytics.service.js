"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANALYTICS_RANGES = void 0;
exports.getAnalytics = getAnalytics;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
const availability_service_1 = require("../schedule/availability.service");
// FEAT-081: BFF de Analytics financeiro. Uma chamada → 3 datasets para os gráficos.
exports.ANALYTICS_RANGES = ['LAST_7_DAYS', 'LAST_14_DAYS', 'CURRENT_MONTH'];
const DAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const MS_DAY = 24 * 60 * 60 * 1000;
// Lista de dias (YYYY-MM-DD no fuso do negócio) do intervalo, inclusivo até hoje.
function buildDays(range) {
    const today = (0, availability_service_1.localDateString)(new Date());
    let firstDay;
    if (range === 'CURRENT_MONTH') {
        firstDay = today.slice(0, 7) + '-01'; // RN03: 1º dia do mês corrente
    }
    else {
        const n = range === 'LAST_7_DAYS' ? 7 : 14;
        firstDay = (0, availability_service_1.localDateString)(new Date((0, availability_service_1.localDayRangeUtc)(today).dayStartUtc.getTime() - (n - 1) * MS_DAY));
    }
    const days = [];
    let cursor = (0, availability_service_1.localDayRangeUtc)(firstDay).dayStartUtc.getTime();
    let label = (0, availability_service_1.localDateString)(new Date(cursor));
    while (label <= today) {
        days.push(label);
        cursor += MS_DAY;
        label = (0, availability_service_1.localDateString)(new Date(cursor));
    }
    return days;
}
function num(d) {
    return Number(d.toDecimalPlaces(2));
}
async function getAnalytics(tenantId, rangeRaw) {
    // V01: enum estrito.
    if (!exports.ANALYTICS_RANGES.includes(rangeRaw)) {
        throw new BusinessError_1.BusinessError('INVALID_ANALYTICS_RANGE', 'Filtro de tempo inválido. Escolha entre 7 dias, 14 dias ou Mês Atual.', 400);
    }
    const range = rangeRaw;
    const days = buildDays(range);
    const fromUtc = (0, availability_service_1.localDayRangeUtc)(days[0]).dayStartUtc;
    const toUtc = (0, availability_service_1.localDayRangeUtc)(days[days.length - 1]).dayEndUtc;
    // RN01: apenas CONCLUDED; tenant isolado.
    const appts = await prisma_1.prisma.appointment.findMany({
        where: { tenantId, status: 'CONCLUDED', startTimestamp: { gte: fromUtc, lt: toUtc } },
        select: {
            amountPaid: true,
            startTimestamp: true,
            barberId: true,
            barber: { select: { name: true, isActive: true } },
        },
    });
    const zero = () => new client_1.Prisma.Decimal(0);
    const byDay = new Map();
    const byDow = new Map();
    const byBarber = new Map();
    for (const a of appts) {
        const day = (0, availability_service_1.localDateString)(a.startTimestamp);
        byDay.set(day, (byDay.get(day) ?? zero()).plus(a.amountPaid));
        const dow = (0, availability_service_1.isoWeekday)(day);
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
