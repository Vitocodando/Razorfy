"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentEvent = appointmentEvent;
exports.barberCall = barberCall;
exports.scheduleReminder = scheduleReminder;
exports.noShowPenalty = noShowPenalty;
exports.winBack = winBack;
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
// RF06: push isolado "Sua vez chegou" para o cliente do próximo atendimento.
async function barberCall(tx, data) {
    const payload = {
        appointmentId: data.appointmentId,
        barberName: data.barberName,
        title: 'Sua vez chegou!',
        body: `${data.barberName} está pronto para te atender. Dirija-se à cadeira.`,
    };
    await tx.notificationOutbox.create({
        data: {
            appointmentId: data.appointmentId,
            channel: 'PUSH',
            destination: data.clientId,
            eventType: 'BARBER_CALL',
            payload,
            nextAttemptAt: new Date(),
        },
    });
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
async function noShowPenalty(tx, appt, deductedAmount) {
    const payload = {
        appointmentId: appt.id,
        clientName: appt.clientName,
        barberName: appt.barberName,
        startTimestamp: appt.startTimestamp.toISOString(),
        deductedAmount,
        title: 'Reserva marcada como no-show',
        body: 'Sua reserva foi cancelada por não comparecimento e o saldo de cashback foi zerado conforme a política da barbearia.',
    };
    const rows = [
        { appointmentId: appt.id, channel: 'PUSH', destination: appt.clientId, eventType: 'NO_SHOW_PENALTY', payload, nextAttemptAt: new Date() },
    ];
    if (appt.clientPhone) {
        rows.push({ appointmentId: appt.id, channel: 'WHATSAPP', destination: appt.clientPhone, eventType: 'NO_SHOW_PENALTY', payload, nextAttemptAt: new Date() });
    }
    await tx.notificationOutbox.createMany({ data: rows });
}
async function winBack(tx, data) {
    const payload = {
        clientId: data.clientId,
        clientName: data.clientName,
        lastAppointmentDate: data.lastAppointmentDate,
        title: 'Sentimos sua falta',
        body: `${data.clientName}, ja faz 45 dias desde sua ultima visita. Que tal agendar seu proximo horario?`,
    };
    await tx.notificationOutbox.create({
        data: {
            appointmentId: null,
            channel: 'WHATSAPP',
            destination: data.clientPhone,
            eventType: 'WIN_BACK',
            payload,
            nextAttemptAt: new Date(),
        },
    });
}
