"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toReviewDto = toReviewDto;
// RN02 / V03: nota e contagem são públicas; o comentário só é revelado ao próprio
// barbeiro avaliado ou a ADMIN/DEV. Para CLIENT/anônimo o texto vira "***".
function canSeeComment(barberId, viewer) {
    if (!viewer.role)
        return false;
    if (viewer.role === 'ADMIN' || viewer.role === 'DEV')
        return true;
    if (viewer.role === 'BARBER' && viewer.id === barberId)
        return true;
    return false;
}
function toReviewDto(review, viewer) {
    const reveal = canSeeComment(review.barberId, viewer);
    return {
        id: review.id,
        rating: review.rating,
        comment: review.comment === null ? null : reveal ? review.comment : '***',
        clientName: review.client?.name,
        createdAt: review.createdAt,
    };
}
