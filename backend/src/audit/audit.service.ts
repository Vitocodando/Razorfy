import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export async function statusChanged(
  tx: Tx,
  appointmentId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string | null,
  payload: Record<string, unknown>,
) {
  await tx.appointmentStatusHistory.create({
    data: {
      appointmentId,
      fromStatus,
      toStatus,
      changedBy: actorId,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  console.log(`[audit] appointment_status_changed from=${fromStatus} to=${toStatus} actor=${actorId ?? 'system'} appointment=${appointmentId}`);
}
