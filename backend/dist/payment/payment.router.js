"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../common/asyncHandler");
const appointment_service_1 = require("../appointment/appointment.service");
exports.paymentRouter = (0, express_1.Router)();
const WebhookSchema = zod_1.z.object({
    appointmentId: zod_1.z.string().uuid(),
    paymentReference: zod_1.z.string().optional().default(''),
});
exports.paymentRouter.post('/webhooks/mock', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { appointmentId, paymentReference } = WebhookSchema.parse(req.body);
    const appointment = await (0, appointment_service_1.confirmPayment)(appointmentId, paymentReference);
    res.json(appointment);
}));
