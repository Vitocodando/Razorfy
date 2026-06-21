import { config } from '../config';
import { prisma } from '../prisma';
import { localDateString } from '../schedule/availability.service';
import { runWinBackCampaign } from '../admin/admin.service';

let lastRunDate: string | null = null;

// Roda a campanha para cada barbearia ativa (multi-tenant).
export async function runWinBack(referenceDate = localDateString()) {
  const tenants = await prisma.barbershop.findMany({ where: { isActive: true }, select: { id: true } });
  const results = [];
  for (const t of tenants) {
    results.push(await runWinBackCampaign(t.id, referenceDate));
  }
  return { tenants: tenants.length, results };
}

export function startWinBackJob(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: config.BUSINESS_TIMEZONE,
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
      const today = localDateString(now);
      if (hour === 0 && lastRunDate !== today) {
        await runWinBack(today);
        lastRunDate = today;
      }
    } catch (err) {
      console.error('[winback] erro no job:', err);
    }
  }, 5 * 60_000);
}
