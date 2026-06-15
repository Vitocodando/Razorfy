import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { createReview, getBarberReviews, getBarberRating } from './review.service';
import { toReviewDto } from './review.dto';

export const reviewRouter = Router();

const CreateReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

// POST /reviews — cliente avalia o próprio atendimento concluído.
reviewRouter.post('/reviews', authenticate, requireRole('CLIENT'), asyncHandler(async (req, res) => {
  const data = CreateReviewSchema.parse(req.body);
  const review = await createReview(req.user!.id, data);
  res.status(201).json({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt });
}));

// GET /reviews?barberId=X — público; comentário mascarado conforme a role (RN02/V03).
reviewRouter.get('/reviews', optionalAuthenticate, asyncHandler(async (req, res) => {
  const barberId = z.string().uuid().safeParse(req.query.barberId);
  if (!barberId.success) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro barberId é obrigatório.', 400);
  }
  const viewer = { id: req.user?.id, role: req.user?.role };
  const { average, count, reviews } = await getBarberReviews(barberId.data);
  res.json({
    average,
    count,
    reviews: reviews.map(r => toReviewDto(r, viewer)),
  });
}));

// GET /barbers/:id/rating — atalho público só com média e contagem.
reviewRouter.get('/barbers/:id/rating', asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new BusinessError('INVALID_INPUT', 'barberId inválido.', 400);
  res.json(await getBarberRating(id.data));
}));
