export function calculateEnd(start: Date, serviceDurations: number[]): Date {
  const totalMinutes = serviceDurations.reduce((acc, d) => acc + d, 0);
  return new Date(start.getTime() + totalMinutes * 60 * 1000);
}

export function canCancel(appointmentStart: Date, now: Date): boolean {
  const twoHoursBefore = new Date(appointmentStart.getTime() - 2 * 60 * 60 * 1000);
  return twoHoursBefore >= now;
}

export function cashbackEarned(amountPaid: import('@prisma/client').Prisma.Decimal, rate: number): import('@prisma/client').Prisma.Decimal {
  const { Prisma } = require('@prisma/client');
  return new Prisma.Decimal(amountPaid).mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
