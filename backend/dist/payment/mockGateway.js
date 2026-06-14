"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntent = createIntent;
exports.refund = refund;
const uuid_1 = require("uuid");
function createIntent(appointmentId, amountPaid) {
    const reference = `PIX-${(0, uuid_1.v4)()}`;
    const payload = `000201RAZORFY${appointmentId}${amountPaid}`;
    const qrCodeBase64 = Buffer.from(payload).toString('base64');
    return { reference, qrCodeBase64, pixCopyPaste: payload };
}
function refund(appointmentId, paymentReference) {
    console.log(`[payment] estorno simulado appointment_id=${appointmentId} payment_reference=${paymentReference}`);
}
