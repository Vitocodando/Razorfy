"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../common/asyncHandler");
const BusinessError_1 = require("../common/BusinessError");
const authenticate_1 = require("../middleware/authenticate");
const requireRole_1 = require("../middleware/requireRole");
const goal_service_1 = require("./goal.service");
exports.goalRouter = (0, express_1.Router)();
const GoalBodySchema = zod_1.z.object({
    periodStart: zod_1.z.string(),
    periodEnd: zod_1.z.string(),
    targetAppointments: zod_1.z.number().int().positive(),
});
// GET /barbers/:id/goals — barbeiro lê as próprias metas (RN03: leitura); ADMIN/DEV qualquer.
exports.goalRouter.get('/barbers/:id/goals', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (user.role === 'CLIENT')
        throw new BusinessError_1.BusinessError('FORBIDDEN', 'Acesso negado.', 403);
    if (user.role === 'BARBER' && user.id !== req.params.id) {
        throw new BusinessError_1.BusinessError('FORBIDDEN', 'Acesso negado.', 403);
    }
    res.json(await (0, goal_service_1.listBarberGoals)(req.params.id));
}));
// POST /barber-goals — RN03: apenas ADMIN/DEV definem metas.
exports.goalRouter.post('/barber-goals', authenticate_1.authenticate, (0, requireRole_1.requireRole)('ADMIN', 'DEV'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const barberId = zod_1.z.string().uuid().parse(req.body?.barberId);
    const body = GoalBodySchema.parse(req.body);
    const goal = await (0, goal_service_1.createGoal)({ barberId, ...body });
    res.status(201).json(goal);
}));
// PUT /barber-goals/:id
exports.goalRouter.put('/barber-goals/:id', authenticate_1.authenticate, (0, requireRole_1.requireRole)('ADMIN', 'DEV'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = GoalBodySchema.parse(req.body);
    const goal = await (0, goal_service_1.updateGoal)(req.params.id, body);
    res.json(goal);
}));
// DELETE /barber-goals/:id
exports.goalRouter.delete('/barber-goals/:id', authenticate_1.authenticate, (0, requireRole_1.requireRole)('ADMIN', 'DEV'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, goal_service_1.deleteGoal)(req.params.id);
    res.status(204).end();
}));
