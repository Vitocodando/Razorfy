import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { requireStrictAdmin } from './admin.middleware';
import {
  CouponSchema,
  CreateBarberSchema,
  CreateServiceSchema,
  GlobalSettingsSchema,
  DateQuerySchema,
  IconSchema,
  NoShowSchema,
  StatusSchema,
  VacationBlockSchema,
} from './admin.schemas';
import { createIcon, listIcons } from '../catalog/icons.service';
import {
  applyNoShow,
  createBarber,
  createCoupon,
  createService,
  createVacationBlock,
  deleteBarber,
  deleteService,
  getGlobalSettings,
  getMyBarbershop,
  updateGlobalSettings,
  deleteCoupon,
  deleteVacationBlock,
  getDashboard,
  getGlobalGrid,
  listAdminAlerts,
  listBarbersAdmin,
  listCoupons,
  listServicesAdmin,
  listVacationBlocks,
  refreshDailyReport,
  resolveAdminAlert,
  runWinBackCampaign,
  setBarberStatus,
  setServiceStatus,
  updateCoupon,
} from './admin.service';
import { getAnalytics } from './analytics.service';

export const adminRouter = Router();

adminRouter.use(authenticate, requireStrictAdmin);

const UuidParam = z.string().uuid();

// Tenant do admin autenticado (isolamento de todas as operações — Fase 2).
// Rotas admin sempre têm tenant (role ADMIN nunca é DEV); asserção segura.
const T = (req: import('express').Request) => req.user!.tenantId!;

adminRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.query);
  res.json(await getDashboard(T(req), date));
}));

adminRouter.post('/reports/daily/rebuild', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.body ?? {});
  res.json(await refreshDailyReport(T(req), date));
}));

adminRouter.get('/appointments/grid', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.query);
  res.json(await getGlobalGrid(T(req), date));
}));

adminRouter.post('/appointments/:appointmentId/no-show', asyncHandler(async (req, res) => {
  const appointmentId = UuidParam.parse(req.params.appointmentId);
  const body = NoShowSchema.parse(req.body ?? {});
  res.json(await applyNoShow(req.user!.id, T(req), appointmentId, body.reason));
}));

adminRouter.get('/coupons', asyncHandler(async (req, res) => {
  res.json(await listCoupons(T(req)));
}));

adminRouter.post('/coupons', asyncHandler(async (req, res) => {
  const body = CouponSchema.parse(req.body);
  res.status(201).json(await createCoupon(T(req), body));
}));

adminRouter.put('/coupons/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  const body = CouponSchema.parse(req.body);
  res.json(await updateCoupon(T(req), id, body));
}));

adminRouter.delete('/coupons/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteCoupon(T(req), id);
  res.status(204).end();
}));

adminRouter.get('/vacation-blocks', asyncHandler(async (req, res) => {
  res.json(await listVacationBlocks(T(req)));
}));

adminRouter.post('/vacation-blocks', asyncHandler(async (req, res) => {
  const body = VacationBlockSchema.parse(req.body);
  res.status(201).json(await createVacationBlock(req.user!.id, T(req), body));
}));

adminRouter.delete('/vacation-blocks/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteVacationBlock(req.user!.id, T(req), id);
  res.status(204).end();
}));

// Gestão de barbeiros (RF06/RF08 + criação/deleção)
adminRouter.get('/barbers', asyncHandler(async (req, res) => {
  res.json(await listBarbersAdmin(T(req)));
}));

adminRouter.post('/barbers', asyncHandler(async (req, res) => {
  const body = CreateBarberSchema.parse(req.body);
  res.status(201).json(await createBarber(req.user!.id, T(req), body));
}));

adminRouter.patch('/barbers/:id/status', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  const { isActive } = StatusSchema.parse(req.body);
  res.json(await setBarberStatus(req.user!.id, T(req), id, isActive));
}));

adminRouter.delete('/barbers/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteBarber(req.user!.id, T(req), id);
  res.status(204).end();
}));

// Gestão de catálogo (RF07/RF08 + criação/deleção)
adminRouter.get('/services', asyncHandler(async (req, res) => {
  res.json(await listServicesAdmin(T(req)));
}));

adminRouter.post('/services', asyncHandler(async (req, res) => {
  const body = CreateServiceSchema.parse(req.body);
  res.status(201).json(await createService(req.user!.id, T(req), body));
}));

adminRouter.patch('/services/:id/status', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  const { isActive } = StatusSchema.parse(req.body);
  res.json(await setServiceStatus(req.user!.id, T(req), id, isActive));
}));

adminRouter.delete('/services/:id', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  await deleteService(req.user!.id, T(req), id);
  res.status(204).end();
}));

// Barbearia do admin (código de conexão / QR)
adminRouter.get('/barbershop', asyncHandler(async (req, res) => {
  res.json(await getMyBarbershop(T(req)));
}));

// FEAT-082: biblioteca de ícones (admin) — listar e enviar SVG customizado.
adminRouter.get('/icons', asyncHandler(async (req, res) => {
  res.json(await listIcons(T(req)));
}));

adminRouter.post('/icons', asyncHandler(async (req, res) => {
  const { name, svgContent } = IconSchema.parse(req.body);
  res.status(201).json(await createIcon(T(req), name, svgContent));
}));

// FEAT-081: BFF de analytics financeiro (3 datasets para os gráficos).
adminRouter.get('/analytics', asyncHandler(async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : 'LAST_7_DAYS';
  res.json(await getAnalytics(T(req), range));
}));

// Configurações globais (RF04) — cache invalidado no PUT
adminRouter.get('/global-settings', asyncHandler(async (req, res) => {
  res.json(await getGlobalSettings(T(req)));
}));

adminRouter.put('/global-settings', asyncHandler(async (req, res) => {
  const body = GlobalSettingsSchema.parse(req.body);
  res.json(await updateGlobalSettings(req.user!.id, T(req), body));
}));

adminRouter.get('/alerts', asyncHandler(async (req, res) => {
  const status = z.enum(['PENDING', 'RESOLVED']).optional().parse(req.query.status);
  res.json(await listAdminAlerts(T(req), status));
}));

adminRouter.patch('/alerts/:id/resolve', asyncHandler(async (req, res) => {
  const id = UuidParam.parse(req.params.id);
  res.json(await resolveAdminAlert(req.user!.id, T(req), id));
}));

adminRouter.post('/campaigns/win-back/run', asyncHandler(async (req, res) => {
  const { date } = DateQuerySchema.parse(req.body ?? {});
  res.json(await runWinBackCampaign(T(req), date));
}));
