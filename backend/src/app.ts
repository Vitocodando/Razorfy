import express from 'express';
import cors from 'cors';

// Colunas BIGINT (ex.: version) chegam como BigInt e o JSON.stringify nativo não os serializa.
// Os valores aqui cabem com folga em Number (contadores de versão otimista).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};
import { config } from './config';
import { errorHandler } from './common/errorHandler';
import { authRouter } from './auth/auth.router';
import { catalogRouter } from './catalog/catalog.router';
import { scheduleRouter } from './schedule/schedule.router';
import { appointmentRouter } from './appointment/appointment.router';
import { walletRouter } from './cashback/wallet.router';
import { paymentRouter } from './payment/payment.router';
import { reportRouter } from './report/report.router';
import { jobsRouter } from './jobs/jobs.router';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.CORS_ALLOWED_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get('/actuator/health', (_req, res) => res.json({ status: 'UP' }));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', catalogRouter);
  app.use('/api/v1', scheduleRouter);
  app.use('/api/v1/appointments', appointmentRouter);
  app.use('/api/v1', walletRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/v1', reportRouter);
  app.use('/api/internal/jobs', jobsRouter);

  app.use(errorHandler);

  return app;
}
