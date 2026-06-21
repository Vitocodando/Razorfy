import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';

const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'];

export const ALLOWED_BLOCK_DURATIONS = [15, 30, 60] as const;
export type BlockDuration = (typeof ALLOWED_BLOCK_DURATIONS)[number];

// RN04: cria um bloqueio a partir de agora; nega se houver interseção temporal com
// agendamentos ativos ou com outros bloqueios. Lock pessimista do barbeiro (mesmo
// padrão de appointment.service.createAppointment) evita corrida com novos bookings.
export async function createExpressBlock(barberId: string, durationMinutes: BlockDuration, reason?: string) {
  const start = new Date();
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return prisma.$transaction(async tx => {
    const barberRows = await (tx as typeof prisma).$queryRaw<Array<{ id: string; role: string; tenant_id: string }>>`
      SELECT id, role, tenant_id FROM users WHERE id = ${barberId}::uuid FOR UPDATE
    `;
    if (barberRows.length === 0 || barberRows[0].role !== 'BARBER') {
      throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
    }
    const barberTenantId = barberRows[0].tenant_id;

    const conflictAppt = await tx.appointment.findFirst({
      where: {
        barberId,
        status: { in: BLOCKING_STATUSES },
        startTimestamp: { lt: end },
        endTimestamp: { gt: start },
      },
      orderBy: { startTimestamp: 'asc' },
      select: { id: true, startTimestamp: true },
    });
    if (conflictAppt) {
      // Log estruturado da recusa (auditoria/usabilidade — NFR de observabilidade).
      console.log(JSON.stringify({
        event: 'express_block_rejected', reason: 'appointment_collision',
        barberId, requestedStart: start.toISOString(), requestedEnd: end.toISOString(),
        collidingAppointmentId: conflictAppt.id, collidingStartTime: conflictAppt.startTimestamp.toISOString(),
      }));
      throw new BusinessError(
        'BLOCK_COLLISION',
        'Você possui um cliente agendado neste intervalo de tempo.',
        409,
        {
          conflictDetails: {
            collidingAppointmentId: conflictAppt.id,
            collidingStartTime: conflictAppt.startTimestamp.toISOString(),
          },
        },
      );
    }

    const conflictBlock = await tx.scheduleBlock.findFirst({
      where: { barberId, startTimestamp: { lt: end }, endTimestamp: { gt: start } },
      orderBy: { startTimestamp: 'asc' },
      select: { id: true, startTimestamp: true },
    });
    if (conflictBlock) {
      throw new BusinessError(
        'BLOCK_COLLISION',
        'Você já possui um bloqueio neste intervalo de tempo.',
        409,
        {
          conflictDetails: {
            collidingBlockId: conflictBlock.id,
            collidingStartTime: conflictBlock.startTimestamp.toISOString(),
          },
        },
      );
    }

    return tx.scheduleBlock.create({
      data: { barberId, tenantId: barberTenantId, startTimestamp: start, endTimestamp: end, reason: reason ?? null },
    });
  });
}

export async function listBlocksForDate(barberId: string, dayStartUtc: Date, dayEndUtc: Date) {
  return prisma.scheduleBlock.findMany({
    where: { barberId, startTimestamp: { lt: dayEndUtc }, endTimestamp: { gt: dayStartUtc } },
    orderBy: { startTimestamp: 'asc' },
  });
}

export async function deleteExpressBlock(barberId: string, blockId: string) {
  const block = await prisma.scheduleBlock.findUnique({ where: { id: blockId } });
  if (!block || block.barberId !== barberId) {
    throw new BusinessError('BLOCK_NOT_FOUND', 'Bloqueio não encontrado.', 404);
  }
  await prisma.scheduleBlock.delete({ where: { id: blockId } });
}
