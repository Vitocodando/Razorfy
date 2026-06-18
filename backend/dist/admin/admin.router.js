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
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(authenticate_1.authenticate, admin_middleware_1.requireStrictAdmin);
const UuidParam = zod_1.z.string().uuid();
exports.adminRouter.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getDashboard)(date));
}));
exports.adminRouter.post('/reports/daily/rebuild', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.refreshDailyReport)(date));
}));
exports.adminRouter.get('/appointments/grid', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getGlobalGrid)(date));
}));
exports.adminRouter.post('/appointments/:appointmentId/no-show', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const appointmentId = UuidParam.parse(req.params.appointmentId);
    const body = admin_schemas_1.NoShowSchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.applyNoShow)(req.user.id, appointmentId, body.reason));
}));
exports.adminRouter.get('/coupons', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(await (0, admin_service_1.listCoupons)());
}));
exports.adminRouter.post('/coupons', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CouponSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createCoupon)(body));
}));
exports.adminRouter.put('/coupons/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    const body = admin_schemas_1.CouponSchema.parse(req.body);
    res.json(await (0, admin_service_1.updateCoupon)(id, body));
}));
exports.adminRouter.delete('/coupons/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteCoupon)(id);
    res.status(204).end();
}));
exports.adminRouter.get('/commissions', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(await (0, admin_service_1.listCommissions)());
}));
exports.adminRouter.put('/commissions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CommissionSchema.parse(req.body);
    res.json(await (0, admin_service_1.upsertCommission)(req.user.id, body));
}));
exports.adminRouter.post('/commissions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.CommissionSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.upsertCommission)(req.user.id, body));
}));
exports.adminRouter.delete('/commissions/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteCommission)(req.user.id, id);
    res.status(204).end();
}));
exports.adminRouter.get('/commissions/settlement', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { from, to } = admin_schemas_1.RangeQuerySchema.parse(req.query);
    res.json(await (0, admin_service_1.getCommissionSettlement)(from, to));
}));
exports.adminRouter.get('/vacation-blocks', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(await (0, admin_service_1.listVacationBlocks)());
}));
exports.adminRouter.post('/vacation-blocks', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = admin_schemas_1.VacationBlockSchema.parse(req.body);
    res.status(201).json(await (0, admin_service_1.createVacationBlock)(req.user.id, body));
}));
exports.adminRouter.delete('/vacation-blocks/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    await (0, admin_service_1.deleteVacationBlock)(req.user.id, id);
    res.status(204).end();
}));
exports.adminRouter.get('/alerts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const status = zod_1.z.enum(['PENDING', 'RESOLVED']).optional().parse(req.query.status);
    res.json(await (0, admin_service_1.listAdminAlerts)(status));
}));
exports.adminRouter.patch('/alerts/:id/resolve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = UuidParam.parse(req.params.id);
    res.json(await (0, admin_service_1.resolveAdminAlert)(req.user.id, id));
}));
exports.adminRouter.post('/campaigns/win-back/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date } = admin_schemas_1.DateQuerySchema.parse(req.body ?? {});
    res.json(await (0, admin_service_1.runWinBackCampaign)(date));
}));
