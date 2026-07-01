import { config } from '../config';
import { prisma } from '../prisma';
import { localDateString } from '../schedule/availability.service';
import { generatePayables } from '../finance/finance.service';

let lastRunDate: string | null = null;

// FEAT-087: motor mensal — gera as contas a pagar (PENDING) dos moldes ativos de cada tenant.
// Idempotente (índice único fixed_cost_id+due_date): rodar todo dia não duplica.
export async function runGeneratePayables(referenceDate = localDateString()) {
  const tenants = await prisma.barbershop.findMany({ where: { isActive: true }, select: { id: true } });
  let totalGenerated = 0;
  for (const t of tenants) {
    totalGenerated += await generatePayables(t.id, referenceDate);
  }
  // Observabilidade (§8): log estruturado do resultado.
  console.log(`[generate-payables] Job Finalizado: ${totalGenerated} Payables gerados para ${tenants.length} Tenants`);
  return { tenants: tenants.length, generated: totalGenerated };
}

// Job in-process (Render): dispara 1x/dia por volta de 00:00 no fuso do negócio.
// Mesmo padrão do winBack — não depende de CRON_SECRET (que só protege os endpoints HTTP).
export function startGeneratePayablesJob(): ReturnType<typeof setInterval> {
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
        await runGeneratePayables(today);
        lastRunDate = today;
      }
    } catch (err) {
      console.error('[generate-payables] erro no job:', err);
    }
  }, 5 * 60_000);
}
