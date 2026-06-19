import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

// NFR: global_settings é lido a cada checkout/no-show. Cache em memória invalidado só no update.
type Settings = { noShowToleranceMinutes: number; defaultCashbackPct: Prisma.Decimal };

let cache: Settings | null = null;

const DEFAULTS: Settings = {
  noShowToleranceMinutes: 15,
  defaultCashbackPct: new Prisma.Decimal(10),
};

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  // V01: registro único id=1; cria com defaults se ausente.
  const row = await prisma.globalSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, noShowToleranceMinutes: DEFAULTS.noShowToleranceMinutes, defaultCashbackPct: DEFAULTS.defaultCashbackPct },
  });
  cache = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
  return cache;
}

export async function updateSettings(data: { noShowToleranceMinutes: number; defaultCashbackPct: number }): Promise<Settings> {
  const row = await prisma.globalSettings.upsert({
    where: { id: 1 },
    update: {
      noShowToleranceMinutes: data.noShowToleranceMinutes,
      defaultCashbackPct: new Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
    },
    create: {
      id: 1,
      noShowToleranceMinutes: data.noShowToleranceMinutes,
      defaultCashbackPct: new Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
    },
  });
  cache = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
  return cache;
}

export async function getNoShowToleranceMinutes(): Promise<number> {
  return (await getSettings()).noShowToleranceMinutes;
}

// Taxa de cashback como fração (ex.: 10.00% → 0.10) para o motor de crédito.
export async function getCashbackRate(): Promise<number> {
  return (await getSettings()).defaultCashbackPct.div(100).toNumber();
}

export function publicSettings(s: Settings) {
  return {
    noShowToleranceMinutes: s.noShowToleranceMinutes,
    defaultCashbackPct: s.defaultCashbackPct,
  };
}
