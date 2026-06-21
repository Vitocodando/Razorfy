import { Router } from 'express';
import { findActiveServices, findBarbers } from './catalog.service';
import { asyncHandler } from '../common/asyncHandler';

export const catalogRouter = Router();

// Rotas legadas (sem tenant na URL) → resolvem o tenant default (compatibilidade com o app atual).
catalogRouter.get('/services', asyncHandler(async (_req, res) => {
  res.json(await findActiveServices());
}));

catalogRouter.get('/barbers', asyncHandler(async (_req, res) => {
  res.json(await findBarbers());
}));
