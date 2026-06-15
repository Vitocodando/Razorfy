"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReview = createReview;
exports.getBarberReviews = getBarberReviews;
exports.getBarberRating = getBarberRating;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
async function createReview(clientId, data) {
    const appt = await prisma_1.prisma.appointment.findUnique({
        where: { id: data.appointmentId },
        select: { id: true, clientId: true, barberId: true, status: true },
    });
    if (!appt)
        throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    if (appt.clientId !== clientId) {
        // Não vaza existência de agendamentos de terceiros.
        throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    }
    if (appt.status !== 'CONCLUDED') {
        throw new BusinessError_1.BusinessError('REVIEW_NOT_ALLOWED', 'Só é possível avaliar atendimentos concluídos.', 422);
    }
    // barberId/clientId derivados do agendamento (não confia no corpo da requisição).
    return prisma_1.prisma.review.create({
        data: {
            appointmentId: appt.id,
            barberId: appt.barberId,
            clientId: appt.clientId,
            rating: data.rating,
            comment: data.comment?.trim() || null,
        },
    });
}
async function getBarberReviews(barberId) {
    const [agg, reviews] = await Promise.all([
        prisma_1.prisma.review.aggregate({ where: { barberId }, _avg: { rating: true }, _count: true }),
        prisma_1.prisma.review.findMany({
            where: { barberId },
            orderBy: { createdAt: 'desc' },
            include: { client: { select: { name: true } } },
        }),
    ]);
    const average = agg._avg.rating !== null
        ? new client_1.Prisma.Decimal(agg._avg.rating).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP).toNumber()
        : 0;
    return { average, count: agg._count, reviews };
}
async function getBarberRating(barberId) {
    const agg = await prisma_1.prisma.review.aggregate({ where: { barberId }, _avg: { rating: true }, _count: true });
    const average = agg._avg.rating !== null
        ? new client_1.Prisma.Decimal(agg._avg.rating).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP).toNumber()
        : 0;
    return { average, count: agg._count };
}
