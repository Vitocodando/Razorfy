"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEnd = calculateEnd;
exports.canCancel = canCancel;
exports.cashbackEarned = cashbackEarned;
function calculateEnd(start, serviceDurations) {
    const totalMinutes = serviceDurations.reduce((acc, d) => acc + d, 0);
    return new Date(start.getTime() + totalMinutes * 60 * 1000);
}
function canCancel(appointmentStart, now) {
    const twoHoursBefore = new Date(appointmentStart.getTime() - 2 * 60 * 60 * 1000);
    return twoHoursBefore >= now;
}
function cashbackEarned(amountPaid, rate) {
    const { Prisma } = require('@prisma/client');
    return new Prisma.Decimal(amountPaid).mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
