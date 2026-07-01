import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { asyncHandler } from '../common/asyncHandler';
import { runPaymentHoldExpiration } from './paymentHoldExpiration.job';
import { processOutbox } from '../notification/outboxProcessor';
import { runWinBack } from './winBack.job';
import { runGeneratePayables } from './generatePayables.job';

// Endpoints internos acionados por agendador externo (Vercel Cron, cron-job.org, pg_cron).
// O Vercel Cron envia "Authorization: Bearer ${CRON_SECRET}" automaticamente.
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  if (!config.CRON_SECRET) {
    return res.status(503).json({ message: 'CRON_SECRET não configurado.' });
  }
  const header = req.headers.authorization;
  if (header !== `Bearer ${config.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Não autorizado.' });
  }
  next();
}

export const jobsRouter = Router();
jobsRouter.use(requireCronSecret);

const expireHolds = asyncHandler(async (_req: Request, res: Response) => {
  const processed = await runPaymentHoldExpiration();
  res.json({ job: 'expire-holds', processed });
});

const outbox = asyncHandler(async (_req: Request, res: Response) => {
  const sent = await processOutbox();
  res.json({ job: 'process-outbox', sent });
});

const winBack = asyncHandler(async (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const result = await runWinBack(date);
  res.json(result);
});

// FEAT-087: geração mensal de contas a pagar (roda diariamente; idempotente).
const generatePayables = asyncHandler(async (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const result = await runGeneratePayables(date);
  res.json({ job: 'generate-payables', ...result });
});

jobsRouter.get('/expire-holds', expireHolds);
jobsRouter.post('/expire-holds', expireHolds);
jobsRouter.get('/process-outbox', outbox);
jobsRouter.post('/process-outbox', outbox);
jobsRouter.get('/win-back', winBack);
jobsRouter.post('/win-back', winBack);
jobsRouter.get('/generate-payables', generatePayables);
jobsRouter.post('/generate-payables', generatePayables);
