import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface AppointmentData {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  barberName: string;
  startTimestamp: Date;
  status: string;
}

type OutboxRow = {
  appointmentId: string;
  channel: string;
  destination: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  nextAttemptAt: Date;
};

export async function appointmentEvent(tx: Tx, appt: AppointmentData, eventType: string) {
  const payload: Prisma.InputJsonValue = {
    appointmentId: appt.id,
    clientName: appt.clientName,
    barberName: appt.barberName,
    startTimestamp: appt.startTimestamp.toISOString(),
    status: appt.status,
  };
  const now = new Date();
  const rows: OutboxRow[] = [
    { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType, payload, nextAttemptAt: now },
  ];
  // WhatsApp só quando há telefone (contas criadas via Google podem não ter).
  if (appt.clientPhone) {
    rows.push({ appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType, payload, nextAttemptAt: now });
  }
  await tx.notificationOutbox.createMany({ data: rows });
}

export async function scheduleReminder(tx: Tx, appt: AppointmentData) {
  const remindAt = new Date(appt.startTimestamp.getTime() - 2 * 60 * 60 * 1000);
  if (remindAt <= new Date()) return;
  const payload: Prisma.InputJsonValue = {
    appointmentId: appt.id,
    startTimestamp: appt.startTimestamp.toISOString(),
    barberName: appt.barberName,
  };
  const rows: OutboxRow[] = [
    { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt },
  ];
  if (appt.clientPhone) {
    rows.push({ appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt });
  }
  await tx.notificationOutbox.createMany({ data: rows });
}
