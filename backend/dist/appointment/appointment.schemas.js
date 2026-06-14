"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAppointmentSchema = void 0;
const zod_1 = require("zod");
exports.CreateAppointmentSchema = zod_1.z.object({
    barberId: zod_1.z.string().uuid(),
    serviceIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    startTimestamp: zod_1.z.string().datetime(),
    useCashback: zod_1.z.boolean().default(false),
    cashbackAmountToApply: zod_1.z.number().min(0).nullable().optional(),
    paymentMethod: zod_1.z.enum(['ONLINE_PIX', 'ONLINE_CARD', 'PRESENTIAL']),
});
