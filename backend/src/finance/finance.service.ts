import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { localDateString } from '../schedule/availability.service';
import type { CreateCategoryInput, FixedCostInput } from './finance.schemas';

// FEAT-087: gestão de custos fixos (moldes) e contas a pagar (instâncias mensais).

// Ancora o vencimento no mês (ano/mês 0-based): dia 31 em fevereiro → último dia válido (RN §11).
function anchoredDueDate(year: number, monthIndex: number, dueDay: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(dueDay, lastDay)));
}

// Início (inclusivo) e próximo mês (exclusivo) a partir de 'YYYY-MM' ou de uma data 'YYYY-MM-DD'.
function monthRange(ref: string): { start: Date; nextMonth: Date; year: number; monthIndex: number } {
  const [y, m] = ref.split('-').map(Number);
  const monthIndex = m - 1;
  return {
    start: new Date(Date.UTC(y, monthIndex, 1)),
    nextMonth: new Date(Date.UTC(y, monthIndex + 1, 1)),
    year: y,
    monthIndex,
  };
}

// ---------- Categorias ----------

// Mescla categorias globais (tenant_id NULL, imutáveis) com as do tenant (RN02).
export async function listCategories(tenantId: string) {
  return prisma.expenseCategory.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }] },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, colorHex: true, tenantId: true },
  });
}

export async function createCategory(tenantId: string, data: CreateCategoryInput) {
  return prisma.expenseCategory.create({
    data: { tenantId, name: data.name, colorHex: data.colorHex ?? null },
    select: { id: true, name: true, colorHex: true, tenantId: true },
  });
}

// Garante que a categoria é global OU pertence ao tenant (evita usar categoria de outra barbearia).
async function assertCategoryUsable(tenantId: string, categoryId: string) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId }, select: { tenantId: true } });
  if (!cat || (cat.tenantId !== null && cat.tenantId !== tenantId)) {
    throw new BusinessError('RESOURCE_NOT_FOUND', 'Categoria não encontrada.', 404);
  }
}

// ---------- Moldes (FixedCost) ----------

export async function listFixedCosts(tenantId: string) {
  return prisma.fixedCost.findMany({
    where: { tenantId, isActive: true },
    orderBy: { dueDay: 'asc' },
    include: { category: { select: { id: true, name: true, colorHex: true } } },
  });
}

// FLUXO 3: cria o molde e gera imediatamente a instância do mês corrente.
export async function createFixedCost(tenantId: string, data: FixedCostInput) {
  await assertCategoryUsable(tenantId, data.categoryId);

  const molde = await prisma.fixedCost.create({
    data: {
      tenantId,
      categoryId: data.categoryId,
      description: data.description,
      amount: new Prisma.Decimal(data.amount),
      dueDay: data.dueDay,
    },
  });

  const generated = await generatePayablesForMolde(molde, localDateString());
  return { ...molde, generatedPayables: generated };
}

// RN04: reajuste no molde propaga apenas para as instâncias PENDING com vencimento >= hoje.
export async function updateFixedCost(tenantId: string, id: string, data: FixedCostInput) {
  await assertCategoryUsable(tenantId, data.categoryId);
  const existing = await prisma.fixedCost.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new BusinessError('RESOURCE_NOT_FOUND', 'Custo fixo não encontrado.', 404);

  const todayUtc = new Date(`${localDateString()}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    const molde = await tx.fixedCost.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        dueDay: data.dueDay,
      },
    });
    // Só instâncias futuras ainda não pagas herdam o novo valor/descrição.
    await tx.payable.updateMany({
      where: { fixedCostId: id, tenantId, status: 'PENDING', dueDate: { gte: todayUtc } },
      data: { amount: new Prisma.Decimal(data.amount), description: data.description },
    });
    return molde;
  });
}

// Soft delete: para de gerar futuras; instâncias existentes permanecem (auditoria).
export async function deactivateFixedCost(tenantId: string, id: string) {
  const existing = await prisma.fixedCost.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new BusinessError('RESOURCE_NOT_FOUND', 'Custo fixo não encontrado.', 404);
  await prisma.fixedCost.update({ where: { id }, data: { isActive: false } });
}

// ---------- Contas a pagar (Payable) ----------

export async function listPayables(tenantId: string, month?: string) {
  const ref = month ?? localDateString().slice(0, 7);
  const { start, nextMonth } = monthRange(ref);
  return prisma.payable.findMany({
    where: { tenantId, dueDate: { gte: start, lt: nextMonth } },
    orderBy: { dueDate: 'asc' },
    include: { fixedCost: { select: { category: { select: { name: true, colorHex: true } } } } },
  });
}

// Liquidação transacional idempotente (IDOR-safe: filtra por tenantId; 409 se já paga — RN §10/§12).
export async function payPayable(tenantId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findFirst({ where: { id, tenantId } });
    if (!payable) throw new BusinessError('RESOURCE_NOT_FOUND', 'Conta a pagar não encontrada.', 404);
    if (payable.status === 'PAID') {
      throw new BusinessError('PAYABLE_ALREADY_PAID', 'Esta conta já foi liquidada anteriormente.', 409);
    }
    return tx.payable.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      select: { id: true, status: true, paidAt: true },
    });
  });
}

// ---------- Motor de geração ----------

// Gera a instância do mês de `referenceDate` para um molde, se ainda não existir (idempotente).
async function generatePayablesForMolde(
  molde: { id: string; tenantId: string; description: string; amount: Prisma.Decimal; dueDay: number },
  referenceDate: string,
): Promise<number> {
  const { start, nextMonth, year, monthIndex } = monthRange(referenceDate.slice(0, 7));
  const exists = await prisma.payable.findFirst({
    where: { fixedCostId: molde.id, dueDate: { gte: start, lt: nextMonth } },
    select: { id: true },
  });
  if (exists) return 0;
  await prisma.payable.create({
    data: {
      tenantId: molde.tenantId,
      fixedCostId: molde.id,
      description: molde.description, // cópia p/ imutabilidade histórica
      amount: molde.amount,
      dueDate: anchoredDueDate(year, monthIndex, molde.dueDay),
    },
  });
  return 1;
}

// Motor mensal (cron): gera as instâncias PENDING do mês para todos os moldes ativos do tenant.
export async function generatePayables(tenantId: string, referenceDate = localDateString()): Promise<number> {
  const moldes = await prisma.fixedCost.findMany({ where: { tenantId, isActive: true } });
  let generated = 0;
  for (const m of moldes) {
    generated += await generatePayablesForMolde(m, referenceDate);
  }
  return generated;
}

// ---------- Integração com o dashboard ----------

// Soma das contas PAID no intervalo [startUtc, endUtc) — janela do filtro do dashboard (RN05).
export async function paidExpensesInWindow(tenantId: string, startUtc: Date, endUtc: Date): Promise<Prisma.Decimal> {
  const agg = await prisma.payable.aggregate({
    where: { tenantId, status: 'PAID', paidAt: { gte: startUtc, lt: endUtc } },
    _sum: { amount: true },
  });
  return (agg._sum.amount ?? new Prisma.Decimal(0)).toDecimalPlaces(2);
}
