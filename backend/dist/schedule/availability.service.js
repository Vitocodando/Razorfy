"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isoWeekday = isoWeekday;
exports.localDateString = localDateString;
exports.dateOnlyUtc = dateOnlyUtc;
exports.availableStarts = availableStarts;
exports.localDayRangeUtc = localDayRangeUtc;
exports.assertWorkingTime = assertWorkingTime;
const prisma_1 = require("../prisma");
const config_1 = require("../config");
const BusinessError_1 = require("../common/BusinessError");
const scheduleRules_1 = require("./scheduleRules");
// Colunas TIME chegam do Prisma como Date ancorado em 1970-01-01 UTC
function timeToMinutes(time) {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
}
function slotWindow(slot) {
    return {
        startMinutes: timeToMinutes(slot.startTime),
        endMinutes: timeToMinutes(slot.endTime),
        lunchStartMinutes: slot.lunchStart ? timeToMinutes(slot.lunchStart) : null,
        lunchEndMinutes: slot.lunchEnd ? timeToMinutes(slot.lunchEnd) : null,
    };
}
const GRID_MINUTES = 15;
const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'];
function localMinutesToUtc(dateStr, minutes, tz) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    // Parse as if local time, then adjust for timezone offset
    const naive = new Date(`${dateStr}T${h}:${m}:00`);
    // Get the UTC offset at this wall time in the target timezone
    const utcMs = getUtcFromLocal(dateStr, h, m, tz);
    return new Date(utcMs);
}
function getUtcFromLocal(dateStr, hh, mm, tz) {
    // Use Intl to find what UTC time corresponds to this local time in `tz`
    // Strategy: binary search / approximation via formatting
    const localIso = `${dateStr}T${hh}:${mm}:00`;
    // Make a Date assuming UTC, then check what local time that corresponds to
    const guessUtc = new Date(localIso + 'Z');
    const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).format(guessUtc);
    // formatted is like "2026-06-15, 21:00:00" → parse it
    const match = formatted.match(/(\d{4}-\d{2}-\d{2}),?\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match)
        return guessUtc.getTime();
    const localMs = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`).getTime();
    const targetMs = new Date(localIso + 'Z').getTime();
    const offsetMs = localMs - targetMs;
    return guessUtc.getTime() - offsetMs;
}
function getLocalMinutes(date, tz) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find(p => p.type === 'hour').value);
    const m = Number(parts.find(p => p.type === 'minute').value);
    return h * 60 + m;
}
function isoWeekday(dateStr) {
    // ISO: Mon=1 ... Sun=7
    const d = new Date(dateStr + 'T12:00:00Z');
    const jsDay = d.getUTCDay(); // 0=Sun
    return jsDay === 0 ? 7 : jsDay;
}
function localDateString(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: config_1.config.BUSINESS_TIMEZONE }).format(date);
}
function dateOnlyUtc(dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`);
}
async function availableStarts(barberId, date, durationMinutes, tenantId) {
    if (durationMinutes <= 0 || durationMinutes > 720) {
        throw new BusinessError_1.BusinessError('INVALID_DURATION', 'A duração deve estar entre 1 e 720 minutos.', 400);
    }
    const barber = await prisma_1.prisma.user.findUnique({ where: { id: barberId } });
    if (!barber || barber.role !== 'BARBER') {
        throw new BusinessError_1.BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
    }
    // Isolamento de tenant: barbeiro precisa pertencer à barbearia consultada.
    if (tenantId && barber.tenantId !== tenantId) {
        throw new BusinessError_1.BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
    }
    const dayOfWeek = isoWeekday(date);
    const slot = await prisma_1.prisma.barberSlot.findUnique({
        where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
    });
    if (!slot)
        return [];
    const tz = config_1.config.BUSINESS_TIMEZONE;
    const window = slotWindow(slot);
    const dayStartUtc = new Date(getUtcFromLocal(date, '00', '00', tz));
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);
    const dateOnly = dateOnlyUtc(date);
    const vacation = await prisma_1.prisma.vacationBlock.findFirst({
        where: {
            barberId,
            startDate: { lte: dateOnly },
            endDate: { gte: dateOnly },
        },
    });
    if (vacation)
        return [];
    const booked = await prisma_1.prisma.appointment.findMany({
        where: {
            barberId,
            status: { in: BLOCKING_STATUSES },
            startTimestamp: { lt: dayEndUtc },
            endTimestamp: { gt: dayStartUtc },
        },
    });
    // Bloqueios express também removem horários da grade.
    const blocks = await prisma_1.prisma.scheduleBlock.findMany({
        where: { barberId, startTimestamp: { lt: dayEndUtc }, endTimestamp: { gt: dayStartUtc } },
    });
    const now = new Date();
    const results = [];
    for (let cursor = window.startMinutes; cursor < window.endMinutes; cursor += GRID_MINUTES) {
        const candidateEndMin = cursor + durationMinutes;
        const startUtc = localMinutesToUtc(date, cursor, tz);
        const endUtc = localMinutesToUtc(date, candidateEndMin, tz);
        const startLocalMin = getLocalMinutes(startUtc, tz);
        const endLocalMin = getLocalMinutes(endUtc, tz);
        if (!(0, scheduleRules_1.fits)(window, startLocalMin, endLocalMin, startUtc, endUtc))
            continue;
        if (startUtc <= now)
            continue;
        const blockedByAppt = booked.some(appt => {
            if (appt.status === 'PENDING_PAYMENT' && appt.holdExpiresAt && appt.holdExpiresAt <= now) {
                return false;
            }
            return startUtc < appt.endTimestamp && endUtc > appt.startTimestamp;
        });
        const blockedByBlock = blocks.some(b => startUtc < b.endTimestamp && endUtc > b.startTimestamp);
        if (!blockedByAppt && !blockedByBlock)
            results.push(startUtc);
    }
    return results;
}
// Janela UTC [início, fim) do dia local (BUSINESS_TIMEZONE). Reutilizado pela listagem de bloqueios.
function localDayRangeUtc(date) {
    const tz = config_1.config.BUSINESS_TIMEZONE;
    const dayStartUtc = new Date(getUtcFromLocal(date, '00', '00', tz));
    return { dayStartUtc, dayEndUtc: new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000) };
}
async function assertWorkingTime(barberId, start, end) {
    const tz = config_1.config.BUSINESS_TIMEZONE;
    const startLocalMin = getLocalMinutes(start, tz);
    const endLocalMin = getLocalMinutes(end, tz);
    const startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(start);
    const dayOfWeek = isoWeekday(startDateStr);
    const slot = await prisma_1.prisma.barberSlot.findUnique({
        where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
    });
    if (!slot)
        throw notAvailable();
    const window = slotWindow(slot);
    if (!(0, scheduleRules_1.fits)(window, startLocalMin, endLocalMin, start, end))
        throw notAvailable();
}
function notAvailable() {
    return new BusinessError_1.BusinessError('BARBER_NOT_AVAILABLE', 'O profissional selecionado não possui expediente no horário escolhido.', 422);
}
