import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface AppointmentData {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  barberName: string;
  startTimestamp: Date;
  status: string;
}

export async function appointmentEvent(tx: Tx, appt: AppointmentData, eventType: string) {
  const payload: Prisma.InputJsonValue = {
    appointmentId: appt.id,
    clientName: appt.clientName,
    barberName: appt.barberName,
    startTimestamp: appt.startTimestamp.toISOString(),
    status: appt.status,
  };
  const now = new Date();
  await tx.notificationOutbox.createMany({
    data: [
      { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType, payload, nextAttemptAt: now },
      { appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType, payload, nextAttemptAt: now },
    ],
  });
}

export async function scheduleReminder(tx: Tx, appt: AppointmentData) {
  const remindAt = new Date(appt.startTimestamp.getTime() - 2 * 60 * 60 * 1000);
  if (remindAt <= new Date()) return;
  const payload: Prisma.InputJsonValue = {
    appointmentId: appt.id,
    startTimestamp: appt.startTimestamp.toISOString(),
    barberName: appt.barberName,
  };
  await tx.notificationOutbox.createMany({
    data: [
      { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt },
      { appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt },
    ],
  });
}
