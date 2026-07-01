import { prisma } from '../prisma';
import { localDateString } from '../schedule/availability.service';
import { generatePayables } from '../finance/finance.service';

// FEAT-087: motor mensal — gera as contas a pagar (PENDING) dos moldes ativos de cada tenant.
// Idempotente (índice único fixed_cost_id+mês): rodar todo dia não duplica.
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
