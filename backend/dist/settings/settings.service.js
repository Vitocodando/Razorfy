"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getNoShowToleranceMinutes = getNoShowToleranceMinutes;
exports.getCashbackRate = getCashbackRate;
exports.publicSettings = publicSettings;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
let cache = null;
const DEFAULTS = {
    noShowToleranceMinutes: 15,
    defaultCashbackPct: new client_1.Prisma.Decimal(10),
};
async function getSettings() {
    if (cache)
        return cache;
    // V01: registro único id=1; cria com defaults se ausente.
    const row = await prisma_1.prisma.globalSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, noShowToleranceMinutes: DEFAULTS.noShowToleranceMinutes, defaultCashbackPct: DEFAULTS.defaultCashbackPct },
    });
    cache = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
    return cache;
}
async function updateSettings(data) {
    const row = await prisma_1.prisma.globalSettings.upsert({
        where: { id: 1 },
        update: {
            noShowToleranceMinutes: data.noShowToleranceMinutes,
            defaultCashbackPct: new client_1.Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
        },
        create: {
            id: 1,
            noShowToleranceMinutes: data.noShowToleranceMinutes,
            defaultCashbackPct: new client_1.Prisma.Decimal(data.defaultCashbackPct).toDecimalPlaces(2),
        },
    });
    cache = { noShowToleranceMinutes: row.noShowToleranceMinutes, defaultCashbackPct: row.defaultCashbackPct };
    return cache;
}
async function getNoShowToleranceMinutes() {
    return (await getSettings()).noShowToleranceMinutes;
}
// Taxa de cashback como fração (ex.: 10.00% → 0.10) para o motor de crédito.
async function getCashbackRate() {
    return (await getSettings()).defaultCashbackPct.div(100).toNumber();
}
function publicSettings(s) {
    return {
        noShowToleranceMinutes: s.noShowToleranceMinutes,
        defaultCashbackPct: s.defaultCashbackPct,
    };
}
