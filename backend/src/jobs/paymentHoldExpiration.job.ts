import { prisma } from '../prisma';
import { expirePaymentHold } from '../appointment/appointment.service';

export async function runPaymentHoldExpiration(): Promise<number> {
  const expired = await prisma.appointment.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      holdExpiresAt: { lte: new Date() },
    },
    select: { id: true },
  });
  let processed = 0;
  for (const { id } of expired) {
    try {
      await expirePaymentHold(id);
      processed++;
    } catch (err) {
      console.warn(`[hold-expiration] falha ao expirar appointment ${id}:`, err);
    }
  }
  return processed;
}

export function startPaymentHoldExpirationJob(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      await runPaymentHoldExpiration();
    } catch (err) {
      console.error('[hold-expiration] erro no job:', err);
    }
  }, 60_000);
}
