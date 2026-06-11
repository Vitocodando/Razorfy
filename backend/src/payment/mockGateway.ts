import { v4 as uuidv4 } from 'uuid';

export interface PaymentIntent {
  reference: string;
  qrCodeBase64: string;
  pixCopyPaste: string;
}

export function createIntent(appointmentId: string, amountPaid: string): PaymentIntent {
  const reference = `PIX-${uuidv4()}`;
  const payload = `000201RAZORFY${appointmentId}${amountPaid}`;
  const qrCodeBase64 = Buffer.from(payload).toString('base64');
  return { reference, qrCodeBase64, pixCopyPaste: payload };
}

export function refund(appointmentId: string, paymentReference: string | null) {
  console.log(`[payment] estorno simulado appointment_id=${appointmentId} payment_reference=${paymentReference}`);
}
