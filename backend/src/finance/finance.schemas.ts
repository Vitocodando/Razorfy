import { z } from 'zod';

// FEAT-087: validações do módulo financeiro (custos fixos + contas a pagar).

const HEX = /^#[0-9a-fA-F]{6}$/;

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  colorHex: z.string().regex(HEX, 'Cor deve ser hex #RRGGBB.').optional(),
});

export const FixedCostSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().trim().min(3).max(100),
  amount: z.number().positive(), // > 0 estritamente (RN validação §11)
  dueDay: z.number().int().min(1).max(31),
});

// Edição do molde: mesmos campos (reajuste aplica-se a PENDING futuros — RN04).
export const UpdateFixedCostSchema = FixedCostSchema;

export const MonthQuerySchema = z.object({
  // Mês de referência para listar contas a pagar (YYYY-MM). Default: mês corrente.
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type FixedCostInput = z.infer<typeof FixedCostSchema>;
