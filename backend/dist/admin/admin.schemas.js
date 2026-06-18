"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RangeQuerySchema = exports.DateQuerySchema = exports.NoShowSchema = exports.VacationBlockSchema = exports.CommissionSchema = exports.CouponSchema = void 0;
const zod_1 = require("zod");
exports.CouponSchema = zod_1.z.object({
    code: zod_1.z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,20}$/),
    discountType: zod_1.z.enum(['PERCENTAGE', 'FIXED_VALUE']),
    discountValue: zod_1.z.number().positive(),
    maxUsesGlobal: zod_1.z.number().int().positive().nullable().optional(),
    expiresAt: zod_1.z.string().datetime(),
}).superRefine((data, ctx) => {
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentual deve ser menor ou igual a 100.' });
    }
    if (new Date(data.expiresAt) <= new Date()) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Validade deve ser futura.' });
    }
});
exports.CommissionSchema = zod_1.z.object({
    barberId: zod_1.z.string().uuid(),
    serviceId: zod_1.z.string().uuid(),
    commissionPct: zod_1.z.number().min(0).max(100),
});
exports.VacationBlockSchema = zod_1.z.object({
    barberId: zod_1.z.string().uuid(),
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: zod_1.z.string().max(255).optional(),
});
exports.NoShowSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
});
exports.DateQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
exports.RangeQuerySchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
