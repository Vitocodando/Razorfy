import { z } from 'zod';

export const CouponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,20}$/),
  discountType: z.enum(['PERCENTAGE', 'FIXED_VALUE']),
  discountValue: z.number().positive(),
  maxUsesGlobal: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime(),
}).superRefine((data, ctx) => {
  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentual deve ser menor ou igual a 100.' });
  }
  if (new Date(data.expiresAt) <= new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Validade deve ser futura.' });
  }
});

export const CommissionSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  commissionPct: z.number().min(0).max(100),
});

export const VacationBlockSchema = z.object({
  barberId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(255).optional(),
});

export const NoShowSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const DateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const RangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
