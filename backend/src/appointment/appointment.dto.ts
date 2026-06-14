import { Prisma } from '@prisma/client';
import { PaymentIntent } from '../payment/mockGateway';

// Contrato herdado do backend Java, consumido por frontend e mobile.
interface AppointmentWithRelations {
  id: string;
  status: string;
  totalPrice: Prisma.Decimal;
  cashbackUsed: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  startTimestamp: Date;
  endTimestamp: Date;
  barber: { name: string };
  client?: { name: string };
  services: { serviceName: string; durationMinutes: number; price: Prisma.Decimal }[];
}

export function toAppointmentDto(appt: AppointmentWithRelations, paymentPayload: PaymentIntent | null = null) {
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
