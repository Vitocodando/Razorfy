"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../middleware/authenticate");
const requireRole_1 = require("../middleware/requireRole");
const asyncHandler_1 = require("../common/asyncHandler");
const appointment_schemas_1 = require("./appointment.schemas");
const appointment_dto_1 = require("./appointment.dto");
const appointment_service_1 = require("./appointment.service");
exports.appointmentRouter = (0, express_1.Router)();
exports.appointmentRouter.post('/', authenticate_1.authenticate, (0, requireRole_1.requireRole)('CLIENT'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = appointment_schemas_1.CreateAppointmentSchema.parse(req.body);
    const result = await (0, appointment_service_1.createAppointment)(req.user.id, body, req.user.tenantId);
    res.status(201).json((0, appointment_dto_1.toAppointmentDto)(result.appointment, result.paymentPayload));
}));
exports.appointmentRouter.get('/mine', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const appointments = user.role === 'BARBER'
        ? await (0, appointment_service_1.listBarberAppointments)(user.id)
        : await (0, appointment_service_1.listClientAppointments)(user.id);
    res.json(appointments.map(a => (0, appointment_dto_1.toAppointmentDto)(a)));
}));
exports.appointmentRouter.post('/:id/cancel', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const updated = await (0, appointment_service_1.cancelAppointment)(req.params.id, req.user.id);
    res.json((0, appointment_dto_1.toAppointmentDto)(updated));
}));
exports.appointmentRouter.post('/:id/conclude', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const updated = await (0, appointment_service_1.concludeAppointment)(req.params.id, req.user.id);
    res.json((0, appointment_dto_1.toAppointmentDto)(updated));
}));
// RF06: chamar o cliente do atendimento (push "Sua vez chegou").
exports.appointmentRouter.post('/:id/call-client', authenticate_1.authenticate, (0, requireRole_1.requireRole)('BARBER', 'ADMIN', 'DEV'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, appointment_service_1.callClient)(req.params.id, req.user.id, req.user.role);
    res.json(result);
}));
