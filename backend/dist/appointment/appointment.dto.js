"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAppointmentDto = toAppointmentDto;
const client_1 = require("@prisma/client");
function toAppointmentDto(appt, paymentPayload = null) {
    return {
        appointmentId: appt.id,
        status: appt.status,
        totalPrice: appt.totalPrice,
        cashbackUsed: appt.cashbackUsed,
        couponCode: appt.couponCode ?? null,
        couponDiscount: appt.couponDiscount ?? new client_1.Prisma.Decimal(0),
        amountToPay: appt.amountPaid,
        startTimestamp: appt.startTimestamp,
        endTimestamp: appt.endTimestamp,
        barberName: appt.barber.name,
        clientId: appt.client?.id,
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
