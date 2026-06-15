import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';

function nextDayUtc(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

// RF04: para cada meta, conta atendimentos CONCLUDED do barbeiro no período.
export async function listBarberGoals(barberId: string) {
  const goals = await prisma.barberGoal.findMany({
    where: { barberId },
    orderBy: { periodStart: 'desc' },
  });

  return Promise.all(goals.map(async goal => {
    const completed = await prisma.appointment.count({
      where: {
        barberId,
        status: 'CONCLUDED',
        startTimestamp: { gte: goal.periodStart, lt: nextDayUtc(goal.periodEnd) },
      },
    });
    const progressPct = goal.targetAppointments > 0
      ? Math.min(100, Math.round((completed / goal.targetAppointments) * 100))
      : 0;
    return {
      id: goal.id,
      periodStart: goal.periodStart,
      periodEnd: goal.periodEnd,
      targetAppointments: goal.targetAppointments,
      completed,
      progressPct,
    };
  }));
}

function parseDate(label: string, value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BusinessError('INVALID_INPUT', `${label} deve estar no formato YYYY-MM-DD.`, 400);
  }
  return new Date(`${value}T00:00:00Z`);
}

export async function createGoal(data: { barberId: string; periodStart: string; periodEnd: string; targetAppointments: number }) {
  const barber = await prisma.user.findUnique({ where: { id: data.barberId } });
  if (!barber || barber.role !== 'BARBER') {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }
  const periodStart = parseDate('periodStart', data.periodStart);
  const periodEnd = parseDate('periodEnd', data.periodEnd);
  if (periodEnd < periodStart) {
    throw new BusinessError('INVALID_GOAL_PERIOD', 'O fim do período deve ser igual ou posterior ao início.', 422);
  }
  if (data.targetAppointments <= 0) {
    throw new BusinessError('INVALID_GOAL_TARGET', 'A meta de atendimentos deve ser maior que zero.', 422);
  }
  return prisma.barberGoal.create({
    data: { barberId: data.barberId, periodStart, periodEnd, targetAppointments: data.targetAppointments },
  });
}

export async function updateGoal(goalId: string, data: { periodStart: string; periodEnd: string; targetAppointments: number }) {
  const existing = await prisma.barberGoal.findUnique({ where: { id: goalId } });
  if (!existing) throw new BusinessError('GOAL_NOT_FOUND', 'Meta não encontrada.', 404);
  const periodStart = parseDate('periodStart', data.periodStart);
  const periodEnd = parseDate('periodEnd', data.periodEnd);
  if (periodEnd < periodStart) {
    throw new BusinessError('INVALID_GOAL_PERIOD', 'O fim do período deve ser igual ou posterior ao início.', 422);
  }
  if (data.targetAppointments <= 0) {
    throw new BusinessError('INVALID_GOAL_TARGET', 'A meta de atendimentos deve ser maior que zero.', 422);
  }
  return prisma.barberGoal.update({
    where: { id: goalId },
    data: { periodStart, periodEnd, targetAppointments: data.targetAppointments },
  });
}

export async function deleteGoal(goalId: string) {
  const existing = await prisma.barberGoal.findUnique({ where: { id: goalId } });
  if (!existing) throw new BusinessError('GOAL_NOT_FOUND', 'Meta não encontrada.', 404);
  await prisma.barberGoal.delete({ where: { id: goalId } });
}
