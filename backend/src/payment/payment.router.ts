import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/asyncHandler';
import { confirmPayment } from '../appointment/appointment.service';

export const paymentRouter = Router();

const WebhookSchema = z.object({
  appointmentId: z.string().uuid(),
  paymentReference: z.string().optional().default(''),
});

paymentRouter.post('/webhooks/mock', asyncHandler(async (req, res) => {
  const { appointmentId, paymentReference } = WebhookSchema.parse(req.body);
  const appointment = await confirmPayment(appointmentId, paymentReference);
  res.json(appointment);
}));
