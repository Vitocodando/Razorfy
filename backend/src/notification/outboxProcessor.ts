import { prisma } from '../prisma';
import { config } from '../config';

export async function processOutbox(): Promise<number> {
  const messages = await prisma.notificationOutbox.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let sent = 0;
  for (const msg of messages) {
    try {
      await send(msg);
      await prisma.notificationOutbox.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      sent++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const nextAttempt = new Date(Date.now() + 5 * 60 * 1000);
      const newAttempts = msg.attempts + 1;
      if (newAttempts >= config.NOTIFICATION_MAX_ATTEMPTS) {
        await prisma.notificationOutbox.update({
          where: { id: msg.id },
          data: { status: 'FAILED', lastError: errMsg, attempts: newAttempts },
        });
      } else {
        await prisma.notificationOutbox.update({
          where: { id: msg.id },
          data: { lastError: errMsg, attempts: newAttempts, nextAttemptAt: nextAttempt },
        });
      }
      console.warn(`[outbox] falha ao enviar ${msg.eventType}: ${errMsg}`);
    }
  }
  return sent;
}

export function startOutboxProcessor(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      await processOutbox();
    } catch (err) {
      console.error('[outbox] erro no processador:', err);
    }
  }, 5_000);
}

async function send(msg: { channel: string; destination: string; eventType: string; payload: unknown }) {
  if (msg.channel === 'PUSH') {
    console.log(`[push] enviado para ${msg.destination}: ${msg.eventType}`);
    return;
  }
  const url = config.WHATSAPP_GATEWAY_URL;
  if (!url) {
    console.log(`[whatsapp] simulado para ${msg.destination}: ${msg.eventType}`);
    return;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: msg.destination, event: msg.eventType, payload: msg.payload }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
