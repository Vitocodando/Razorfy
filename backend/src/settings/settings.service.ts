import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

// NFR: global_settings é lido a cada checkout/no-show. Cache em memória POR TENANT,
// invalidado só no update daquele tenant.
type Settings = { noShowToleranceMinutes: number; defaultCashbackPct: Prisma.Decimal };

const cache = new Map<string, Settings>();

const DEFAULTS: Settings = {
  noShowToleranceMinutes: 15,
  defaultCashbackPct: new Prisma.Decimal(10),
};

export async function getSettings(tenantId: string): Promise<Settings> {
  const cached = cache.get(tenantId);
  if (cached) return cached;
  // V01: um registro por tenant; cria com defaults se ausente.
  const row = await prisma.globalSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, noShowToleranceMinutes: DEFAULTS.noShowToleranceMinutes, defaultCashbackPct: DEFAULTS.defaultCashbackPct },
  });
  const value = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
  cache.set(tenantId, value);
  return value;
}

export async function updateSettings(tenantId: string, data: { noShowToleranceMinutes: number; defaultCashbackPct: number }): Promise<Settings> {
  const row = await prisma.globalSettings.upsert({
    where: { tenantId },
    update: {
      noShowToleranceMinutes: data.noShowToleranceMinutes,
      defaultCashbackPct: new Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
    },
    create: {
      tenantId,
      noShowToleranceMinutes: data.noShowToleranceMinutes,
      defaultCashbackPct: new Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
    },
  });
  const value = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
  cache.set(tenantId, value);
  return value;
}

export async function getNoShowToleranceMinutes(tenantId: string): Promise<number> {
  return (await getSettings(tenantId)).noShowToleranceMinutes;
}

// Taxa de cashback como fração (ex.: 10.00% → 0.10) para o motor de crédito.
export async function getCashbackRate(tenantId: string): Promise<number> {
  return (await getSettings(tenantId)).defaultCashbackPct.div(100).toNumber();
}

export function publicSettings(s: Settings) {
  return {
    noShowToleranceMinutes: s.noShowToleranceMinutes,
    defaultCashbackPct: s.defaultCashbackPct,
  };
}
