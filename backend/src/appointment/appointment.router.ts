import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../common/asyncHandler';
import { CreateAppointmentSchema } from './appointment.schemas';
import { toAppointmentDto } from './appointment.dto';
import {
  createAppointment,
  cancelAppointment,
  concludeAppointment,
  listClientAppointments,
  listBarberAppointments,
  callClient,
} from './appointment.service';

export const appointmentRouter = Router();

appointmentRouter.post(
  '/',
  authenticate,
  requireRole('CLIENT'),
  asyncHandler(async (req, res) => {
    const body = CreateAppointmentSchema.parse(req.body);
    const result = await createAppointment(req.user!.id, body, req.user!.tenantId!);
    res.status(201).json(toAppointmentDto(result.appointment, result.paymentPayload));
  }),
);

appointmentRouter.get(
  '/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const appointments = user.role === 'BARBER'
      ? await listBarberAppointments(user.id)
      : await listClientAppointments(user.id);
    res.json(appointments.map(a => toAppointmentDto(a)));
  }),
);

appointmentRouter.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const updated = await cancelAppointment(req.params.id, req.user!.id);
    res.json(toAppointmentDto(updated));
  }),
);

appointmentRouter.post(
  '/:id/conclude',
  authenticate,
  asyncHandler(async (req, res) => {
    const updated = await concludeAppointment(req.params.id, req.user!.id);
    res.json(toAppointmentDto(updated));
  }),
);

// RF06: chamar o cliente do atendimento (push "Sua vez chegou").
appointmentRouter.post(
  '/:id/call-client',
  authenticate,
  requireRole('BARBER', 'ADMIN', 'DEV'),
  asyncHandler(async (req, res) => {
    const result = await callClient(req.params.id, req.user!.id, req.user!.role);
    res.json(result);
  }),
);
