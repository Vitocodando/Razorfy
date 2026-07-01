import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { requireStrictAdmin } from '../admin/admin.middleware';
import {
  CreateCategorySchema,
  FixedCostSchema,
  UpdateFixedCostSchema,
  MonthQuerySchema,
} from './finance.schemas';
import {
  listCategories,
  createCategory,
  listFixedCosts,
  createFixedCost,
  updateFixedCost,
  deactivateFixedCost,
  listPayables,
  payPayable,
} from './finance.service';

// FEAT-087: fluxo de caixa (custos fixos + contas a pagar). Restrito a ADMIN (RN01).
export const financeRouter = Router();

financeRouter.use(authenticate, requireStrictAdmin);

const UuidParam = z.string().uuid();
// Admin sempre tem tenant (nunca DEV) — asserção segura, isola todas as operações.
const T = (req: import('express').Request) => req.user!.tenantId!;

// ---------- Categorias ----------
financeRouter.get('/categories', asyncHandler(async (req, res) => {
  res.json(await listCategories(T(req)));
}));

financeRouter.post('/categories', asyncHandler(async (req, res) => {
  const data = CreateCategorySchema.parse(req.body);
  res.status(201).json(await createCategory(T(req), data));
}));

// ---------- Moldes (custos fixos) ----------
financeRouter.get('/fixed-costs', asyncHandler(async (req, res) => {
  res.json(await listFixedCosts(T(req)));
}));

financeRouter.post('/fixed-costs', asyncHandler(async (req, res) => {
  const data = FixedCostSchema.parse(req.body);
  res.status(201).json(await createFixedCost(T(req), data));
}));

financeRouter.put('/fixed-costs/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  const data = UpdateFixedCostSchema.parse(req.body);
  res.json(await updateFixedCost(T(req), id, data));
}));

financeRouter.delete('/fixed-costs/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deactivateFixedCost(T(req), id);
  res.status(204).send();
}));

// ---------- Contas a pagar ----------
financeRouter.get('/payables', asyncHandler(async (req, res) => {
  const { month } = MonthQuerySchema.parse(req.query);
  res.json(await listPayables(T(req), month));
}));

financeRouter.patch('/payables/:id/pay', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  res.json(await payPayable(T(req), id));
}));
