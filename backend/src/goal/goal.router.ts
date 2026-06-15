import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { listBarberGoals, createGoal, updateGoal, deleteGoal } from './goal.service';

export const goalRouter = Router();

const GoalBodySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  targetAppointments: z.number().int().positive(),
});

// GET /barbers/:id/goals — barbeiro lê as próprias metas (RN03: leitura); ADMIN/DEV qualquer.
goalRouter.get('/barbers/:id/goals', authenticate, asyncHandler(async (req, res) => {
  const user = req.user!;
  if (user.role === 'CLIENT') throw new BusinessError('FORBIDDEN', 'Acesso negado.', 403);
  if (user.role === 'BARBER' && user.id !== req.params.id) {
    throw new BusinessError('FORBIDDEN', 'Acesso negado.', 403);
  }
  res.json(await listBarberGoals(req.params.id));
}));

// POST /barber-goals — RN03: apenas ADMIN/DEV definem metas.
goalRouter.post('/barber-goals', authenticate, requireRole('ADMIN', 'DEV'), asyncHandler(async (req, res) => {
  const barberId = z.string().uuid().parse(req.body?.barberId);
  const body = GoalBodySchema.parse(req.body);
  const goal = await createGoal({ barberId, ...body });
  res.status(201).json(goal);
}));

// PUT /barber-goals/:id
goalRouter.put('/barber-goals/:id', authenticate, requireRole('ADMIN', 'DEV'), asyncHandler(async (req, res) => {
  const body = GoalBodySchema.parse(req.body);
  const goal = await updateGoal(req.params.id, body);
  res.json(goal);
}));

// DELETE /barber-goals/:id
goalRouter.delete('/barber-goals/:id', authenticate, requireRole('ADMIN', 'DEV'), asyncHandler(async (req, res) => {
  await deleteGoal(req.params.id);
  res.status(204).end();
}));
