"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../common/asyncHandler");
const BusinessError_1 = require("../common/BusinessError");
const authenticate_1 = require("../middleware/authenticate");
const requireRole_1 = require("../middleware/requireRole");
const review_service_1 = require("./review.service");
const review_dto_1 = require("./review.dto");
exports.reviewRouter = (0, express_1.Router)();
const CreateReviewSchema = zod_1.z.object({
    appointmentId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional(),
});
// POST /reviews — cliente avalia o próprio atendimento concluído.
exports.reviewRouter.post('/reviews', authenticate_1.authenticate, (0, requireRole_1.requireRole)('CLIENT'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = CreateReviewSchema.parse(req.body);
    const review = await (0, review_service_1.createReview)(req.user.id, data);
    res.status(201).json({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt });
}));
// GET /reviews?barberId=X — público; comentário mascarado conforme a role (RN02/V03).
exports.reviewRouter.get('/reviews', authenticate_1.optionalAuthenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const barberId = zod_1.z.string().uuid().safeParse(req.query.barberId);
    if (!barberId.success) {
        throw new BusinessError_1.BusinessError('INVALID_INPUT', 'O parâmetro barberId é obrigatório.', 400);
    }
    const viewer = { id: req.user?.id, role: req.user?.role };
    const { average, count, reviews } = await (0, review_service_1.getBarberReviews)(barberId.data);
    res.json({
        average,
        count,
        reviews: reviews.map(r => (0, review_dto_1.toReviewDto)(r, viewer)),
    });
}));
// GET /barbers/:id/rating — atalho público só com média e contagem.
exports.reviewRouter.get('/barbers/:id/rating', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = zod_1.z.string().uuid().safeParse(req.params.id);
    if (!id.success)
        throw new BusinessError_1.BusinessError('INVALID_INPUT', 'barberId inválido.', 400);
    res.json(await (0, review_service_1.getBarberRating)(id.data));
}));
