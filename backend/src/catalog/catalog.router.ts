import { Router } from 'express';
import { findActiveServices, findBarbers } from './catalog.service';
import { asyncHandler } from '../common/asyncHandler';

export const catalogRouter = Router();

catalogRouter.get('/services', asyncHandler(async (_req, res) => {
  const services = await findActiveServices();
  res.json(services);
}));

catalogRouter.get('/barbers', asyncHandler(async (_req, res) => {
  const barbers = await findBarbers();
  res.json(barbers);
}));
