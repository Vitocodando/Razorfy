import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';

export async function createReview(clientId: string, data: { appointmentId: string; rating: number; comment?: string }) {
  const appt = await prisma.appointment.findUnique({
    where: { id: data.appointmentId },
    select: { id: true, clientId: true, barberId: true, status: true },
  });
  if (!appt) throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
  if (appt.clientId !== clientId) {
    // Não vaza existência de agendamentos de terceiros.
    throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  if (appt.status !== 'CONCLUDED') {
    throw new BusinessError('REVIEW_NOT_ALLOWED', 'Só é possível avaliar atendimentos concluídos.', 422);
  }

  // barberId/clientId derivados do agendamento (não confia no corpo da requisição).
  return prisma.review.create({
    data: {
      appointmentId: appt.id,
      barberId: appt.barberId,
      clientId: appt.clientId,
      rating: data.rating,
      comment: data.comment?.trim() || null,
    },
  });
}

export async function getBarberReviews(barberId: string) {
  const [agg, reviews] = await Promise.all([
    prisma.review.aggregate({ where: { barberId }, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({
      where: { barberId },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } } },
    }),
  ]);
  const average = agg._avg.rating !== null
    ? new Prisma.Decimal(agg._avg.rating).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()
    : 0;
  return { average, count: agg._count, reviews };
}

export async function getBarberRating(barberId: string) {
  const agg = await prisma.review.aggregate({ where: { barberId }, _avg: { rating: true }, _count: true });
  const average = agg._avg.rating !== null
    ? new Prisma.Decimal(agg._avg.rating).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()
    : 0;
  return { average, count: agg._count };
}
