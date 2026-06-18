import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { requireStrictAdmin } from './admin.middleware';
import {
  CouponSchema,
  CommissionSchema,
  DateQuerySchema,
  NoShowSchema,
  RangeQuerySchema,
  VacationBlockSchema,
} from './admin.schemas';
import {
  applyNoShow,
  createCoupon,
  createVacationBlock,
  deleteCommission,
  deleteCoupon,
  deleteVacationBlock,
  getCommissionSettlement,
  getDashboard,
  getGlobalGrid,
  listAdminAlerts,
  listCommissions,
  listCoupons,
  listVacationBlocks,
  refreshDailyReport,
  resolveAdminAlert,
  runWinBackCampaign,
  updateCoupon,
  upsertCommission,
} from './admin.service';

export const adminRouter = Router();

adminRouter.use(authenticate, requireStrictAdmin);

const UuidParam = z.string().uuid();

adminRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.query);
  res.json(await getDashboard(date));
}));

adminRouter.post('/reports/daily/rebuild', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.body ?? {});
  res.json(await refreshDailyReport(date));
}));

adminRouter.get('/appointments/grid', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.query);
  res.json(await getGlobalGrid(date));
}));

adminRouter.post('/appointments/:appointmentId/no-show', asyncHandler(async (req, res) => {
  const appointmentId = UuidParam.parse(req.params.appointmentId);
  const body = NoShowSchema.parse(req.body ?? {});
  res.json(await applyNoShow(req.user!.id, appointmentId, body.reason));
}));

adminRouter.get('/coupons', asyncHandler(async (_req, res) => {
  res.json(await listCoupons());
}));

adminRouter.post('/coupons', asyncHandler(async (req, res) => {
  const body = CouponSchema.parse(req.body);
  res.status(201).json(await createCoupon(body));
}));

adminRouter.put('/coupons/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  const body = CouponSchema.parse(req.body);
  res.json(await updateCoupon(id, body));
}));

adminRouter.delete('/coupons/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteCoupon(id);
  res.status(204).end();
}));

adminRouter.get('/commissions', asyncHandler(async (_req, res) => {
  res.json(await listCommissions());
}));

adminRouter.put('/commissions', asyncHandler(async (req, res) => {
  const body = CommissionSchema.parse(req.body);
  res.json(await upsertCommission(req.user!.id, body));
}));

adminRouter.post('/commissions', asyncHandler(async (req, res) => {
  const body = CommissionSchema.parse(req.body);
  res.status(201).json(await upsertCommission(req.user!.id, body));
}));

adminRouter.delete('/commissions/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteCommission(req.user!.id, id);
  res.status(204).end();
}));

adminRouter.get('/commissions/settlement', asyncHandler(async (req, res) => {
  const { from, to } = RangeQuerySchema.parse(req.query);
  res.json(await getCommissionSettlement(from, to));
}));

adminRouter.get('/vacation-blocks', asyncHandler(async (_req, res) => {
  res.json(await listVacationBlocks());
}));

adminRouter.post('/vacation-blocks', asyncHandler(async (req, res) => {
  const body = VacationBlockSchema.parse(req.body);
  res.status(201).json(await createVacationBlock(req.user!.id, body));
}));

adminRouter.delete('/vacation-blocks/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteVacationBlock(req.user!.id, id);
  res.status(204).end();
}));

adminRouter.get('/alerts', asyncHandler(async (req, res) => {
  const status = z.enum(['PENDING', 'RESOLVED']).optional().parse(req.query.status);
  res.json(await listAdminAlerts(status));
}));

adminRouter.patch('/alerts/:id/resolve', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  res.json(await resolveAdminAlert(req.user!.id, id));
}));

adminRouter.post('/campaigns/win-back/run', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.body ?? {});
  res.json(await runWinBackCampaign(date));
}));
