"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getNoShowToleranceMinutes = getNoShowToleranceMinutes;
exports.getCashbackRate = getCashbackRate;
exports.publicSettings = publicSettings;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const cache = new Map();
const DEFAULTS = {
    noShowToleranceMinutes: 15,
    defaultCashbackPct: new client_1.Prisma.Decimal(10),
};
async function getSettings(tenantId) {
    const cached = cache.get(tenantId);
    if (cached)
        return cached;
    // V01: um registro por tenant; cria com defaults se ausente.
    const row = await prisma_1.prisma.globalSettings.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId, noShowToleranceMinutes: DEFAULTS.noShowToleranceMinutes, defaultCashbackPct: DEFAULTS.defaultCashbackPct },
    });
    const value = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
    cache.set(tenantId, value);
    return value;
}
async function updateSettings(tenantId, data) {
    const row = await prisma_1.prisma.globalSettings.upsert({
        where: { tenantId },
        update: {
            noShowToleranceMinutes: data.noShowToleranceMinutes,
            defaultCashbackPct: new client_1.Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
        },
        create: {
            tenantId,
            noShowToleranceMinutes: data.noShowToleranceMinutes,
            defaultCashbackPct: new client_1.Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
        },
    });
    const value = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
    cache.set(tenantId, value);
    return value;
}
async function getNoShowToleranceMinutes(tenantId) {
    return (await getSettings(tenantId)).noShowToleranceMinutes;
}
// Taxa de cashback como fração (ex.: 10.00% → 0.10) para o motor de crédito.
async function getCashbackRate(tenantId) {
    return (await getSettings(tenantId)).defaultCashbackPct.div(100).toNumber();
}
function publicSettings(s) {
    return {
        noShowToleranceMinutes: s.noShowToleranceMinutes,
        defaultCashbackPct: s.defaultCashbackPct,
    };
}
