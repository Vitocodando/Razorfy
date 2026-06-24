"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const asyncHandler_1 = require("../common/asyncHandler");
const admin_middleware_1 = require("./admin.middleware");
const admin_schemas_1 = require("./admin.schemas");
const admin_service_1 = require("./admin.service");
const analytics_service_1 = require("./analytics.service");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(authenticate_1.authenticate, admin_middleware_1.requireStrictAdmin);
const UuidParam = zod_1.z.string().uuid();
// Tenant do admin autenticado (isolamento de todas as operações — Fase 2).
// Rotas admin sempre têm tenant (role ADMIN nunca é DEV); asserção segura.
const T = (req) => req.user.tenantId;
exports.adminRouter.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getDashboard)(T(req), date));
}));
exports.adminRouter.post('/reports/daily/rebuild', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.refreshDailyReport)(T(req), date));
}));
exports.adminRouter.get('/appointments/grid', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getGlobalGrid)(T(req), date));
}));
exports.adminRouter.post('/appointments/:appointmentId/no-show', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const appointmentId = UuidParam.parse(req.params.appointmentId);
    const body = admin_schemas_1.NoShowSchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.applyNoShow)(req.user.id, T(req), appointmentId, body.reason));
}));
exports.adminRouter.get('/coupons', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.listCoupons)(T(req)));
}));
exports.adminRouter.post('/coupons', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CouponSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createCoupon)(T(req), body));
}));
exports.adminRouter.put('/coupons/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    const body = admin_schemas_1.CouponSchema.parse(req.body);
    res.json(await (0, admin_service_1.updateCoupon)(T(req), id, body));
}));
exports.adminRouter.delete('/coupons/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteCoupon)(T(req), id);
    res.status(204).end();
}));
exports.adminRouter.get('/commissions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.listCommissions)(T(req)));
}));
exports.adminRouter.put('/commissions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CommissionSchema.parse(req.body);
    res.json(await (0, admin_service_1.upsertCommission)(req.user.id, T(req), body));
}));
exports.adminRouter.post('/commissions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CommissionSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.upsertCommission)(req.user.id, T(req), body));
}));
exports.adminRouter.delete('/commissions/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteCommission)(req.user.id, T(req), id);
    res.status(204).end();
}));
exports.adminRouter.get('/commissions/settlement', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { from, to } = admin_schemas_1.RangeQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getCommissionSettlement)(T(req), from, to));
}));
exports.adminRouter.get('/vacation-blocks', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.listVacationBlocks)(T(req)));
}));
exports.adminRouter.post('/vacation-blocks', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.VacationBlockSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createVacationBlock)(req.user.id, T(req), body));
}));
exports.adminRouter.delete('/vacation-blocks/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteVacationBlock)(req.user.id, T(req), id);
    res.status(204).end();
}));
// Gestão de barbeiros (RF06/RF08 + criação/deleção)
exports.adminRouter.get('/barbers', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.listBarbersAdmin)(T(req)));
}));
exports.adminRouter.post('/barbers', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CreateBarberSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createBarber)(req.user.id, T(req), body));
}));
exports.adminRouter.patch('/barbers/:id/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    const { isActive } = admin_schemas_1.StatusSchema.parse(req.body);
    res.json(await (0, admin_service_1.setBarberStatus)(req.user.id, T(req), id, isActive));
}));
exports.adminRouter.delete('/barbers/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteBarber)(req.user.id, T(req), id);
    res.status(204).end();
}));
// Gestão de catálogo (RF07/RF08 + criação/deleção)
exports.adminRouter.get('/services', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.listServicesAdmin)(T(req)));
}));
exports.adminRouter.post('/services', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CreateServiceSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createService)(req.user.id, T(req), body));
}));
exports.adminRouter.patch('/services/:id/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    const { isActive } = admin_schemas_1.StatusSchema.parse(req.body);
    res.json(await (0, admin_service_1.setServiceStatus)(req.user.id, T(req), id, isActive));
}));
exports.adminRouter.delete('/services/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteService)(req.user.id, T(req), id);
    res.status(204).end();
}));
// Barbearia do admin (código de conexão / QR)
exports.adminRouter.get('/barbershop', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.getMyBarbershop)(T(req)));
}));
// FEAT-081: BFF de analytics financeiro (3 datasets para os gráficos).
exports.adminRouter.get('/analytics', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : 'LAST_7_DAYS';
    res.json(await (0, analytics_service_1.getAnalytics)(T(req), range));
}));
// Configurações globais (RF04) — cache invalidado no PUT
exports.adminRouter.get('/global-settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, admin_service_1.getGlobalSettings)(T(req)));
}));
exports.adminRouter.put('/global-settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.GlobalSettingsSchema.parse(req.body);
    res.json(await (0, admin_service_1.updateGlobalSettings)(req.user.id, T(req), body));
}));
exports.adminRouter.get('/alerts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const status = zod_1.z.enum(['PENDING', 'RESOLVED']).optional().parse(req.query.status);
    res.json(await (0, admin_service_1.listAdminAlerts)(T(req), status));
}));
exports.adminRouter.patch('/alerts/:id/resolve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    res.json(await (0, admin_service_1.resolveAdminAlert)(req.user.id, T(req), id));
}));
exports.adminRouter.post('/campaigns/win-back/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.runWinBackCampaign)(T(req), date));
}));
