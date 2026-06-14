"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAppointmentDto = toAppointmentDto;
function toAppointmentDto(appt, paymentPayload = null) {
    return {
        appointmentId: appt.id,
        status: appt.status,
        totalPrice: appt.totalPrice,
        cashbackUsed: appt.cashbackUsed,
        amountToPay: appt.amountPaid,
        startTimestamp: appt.startTimestamp,
        endTimestamp: appt.endTimestamp,
        barberName: appt.barber.name,
        clientName: appt.client?.name,
        services: appt.services.map(s => ({
            name: s.serviceName,
            durationMinutes: s.durationMinutes,
            price: s.price,
        })),
        paymentPayload: paymentPayload
            ? { qrCodeBase64: paymentPayload.qrCodeBase64, copyPasteCode: paymentPayload.pixCopyPaste }
            : undefined,
    };
}
