"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentEvent = appointmentEvent;
exports.scheduleReminder = scheduleReminder;
async function appointmentEvent(tx, appt, eventType) {
    const payload = {
        appointmentId: appt.id,
        clientName: appt.clientName,
        barberName: appt.barberName,
        startTimestamp: appt.startTimestamp.toISOString(),
        status: appt.status,
    };
    const now = new Date();
    const rows = [
        { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType, payload, nextAttemptAt: now },
    ];
    // WhatsApp só quando há telefone (contas criadas via Google podem não ter).
    if (appt.clientPhone) {
        rows.push({ appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType, payload, nextAttemptAt: now });
    }
    await tx.notificationOutbox.createMany({ data: rows });
}
async function scheduleReminder(tx, appt) {
    const remindAt = new Date(appt.startTimestamp.getTime() - 2 * 60 * 60 * 1000);
    if (remindAt <= new Date())
        return;
    const payload = {
        appointmentId: appt.id,
        startTimestamp: appt.startTimestamp.toISOString(),
        barberName: appt.barberName,
    };
    const rows = [
        { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt },
    ];
    if (appt.clientPhone) {
        rows.push({ appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType: 'APPOINTMENT_REMINDER', payload, nextAttemptAt: remindAt });
    }
    await tx.notificationOutbox.createMany({ data: rows });
}
