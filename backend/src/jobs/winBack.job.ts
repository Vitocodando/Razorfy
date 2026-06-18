import { config } from '../config';
import { localDateString } from '../schedule/availability.service';
import { runWinBackCampaign } from '../admin/admin.service';

let lastRunDate: string | null = null;

export async function runWinBack(referenceDate = localDateString()) {
  return runWinBackCampaign(referenceDate);
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
