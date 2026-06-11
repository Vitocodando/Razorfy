import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  barberId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  startTimestamp: z.string().datetime(),
  useCashback: z.boolean().default(false),
  cashbackAmountToApply: z.number().min(0).nullable().optional(),
  paymentMethod: z.enum(['ONLINE_PIX', 'ONLINE_CARD', 'PRESENTIAL']),
});
