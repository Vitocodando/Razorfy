import { Router } from 'express';
import { availableStarts } from './availability.service';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';

export const scheduleRouter = Router();

scheduleRouter.get('/barbers/:id/availability', asyncHandler(async (req, res) => {
  const barberId = req.params.id;
  const { date, duration } = req.query;
  if (!date || typeof date !== 'string') {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro date é obrigatório (YYYY-MM-DD).', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro date deve estar no formato YYYY-MM-DD.', 400);
  }
  const durationMinutes = duration ? parseInt(String(duration), 10) : 0;
  if (!durationMinutes || isNaN(durationMinutes)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro duration é obrigatório e deve ser um inteiro positivo.', 400);
  }
  const slots = await availableStarts(barberId, date, durationMinutes);
  res.json({ availableStarts: slots.map(d => d.toISOString()) });
}));
