import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';

// Colunas BIGINT (ex.: version) chegam como BigInt e o JSON.stringify nativo não os serializa.
// Os valores aqui cabem com folga em Number (contadores de versão otimista).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

// Prisma.Decimal serializa como string por padrão; o contrato da API (herdado do
// Jackson/BigDecimal do backend Java) usa números JSON para preços e saldos.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function (this: Prisma.Decimal) {
  return this.toNumber();
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
import { reviewRouter } from './review/review.router';
import { goalRouter } from './goal/goal.router';
import { crmRouter } from './crm/crm.router';
import { adminRouter } from './admin/admin.router';
import { userRouter } from './user/user.router';
import { tenantRouter, barbershopRouter } from './catalog/tenant.router';
import { platformRouter } from './platform/platform.router';
import { financeRouter } from './finance/finance.router';
import { globalLimiter } from './common/rateLimit';

export function createApp() {
  const app = express();

  // SEC: IP real por trás do proxy (Render/Vercel) — necessário para rate-limit por IP.
  app.set('trust proxy', 1);

  // SEC: headers de segurança (clickjacking, MIME-sniffing, HSTS). API JSON pura → CSP restritiva.
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 15552000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  // CORS_ALLOWED_ORIGIN aceita lista separada por vírgula (apex, www, previews, localhost).
  // Normaliza removendo barra final — o browser nunca envia Origin com barra.
  const stripSlash = (s: string) => s.trim().replace(/\/+$/, '');
  const allowedOrigins = config.CORS_ALLOWED_ORIGIN.split(',').map(stripSlash).filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      // Sem Origin (curl/health/server-to-server) ou origem na lista → permite.
      if (!origin || allowedOrigins.includes(stripSlash(origin))) return callback(null, true);
      callback(new Error(`Origin não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json());

  // SEC: limite global suave (anti-scraping/DoS). Health fica fora para não afetar uptime checks.
  app.get('/actuator/health', (_req, res) => res.json({ status: 'UP' }));
  app.use(globalLimiter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/barbershops', barbershopRouter);
  app.use('/api/v1/tenants', tenantRouter);
  app.use('/api/v1', catalogRouter);
  app.use('/api/v1', scheduleRouter);
  app.use('/api/v1/appointments', appointmentRouter);
  app.use('/api/v1', walletRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/v1', reportRouter);
  app.use('/api/v1', reviewRouter);
  app.use('/api/v1', goalRouter);
  app.use('/api/v1', crmRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/finances', financeRouter);
  app.use('/api/v1/platform', platformRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/internal/jobs', jobsRouter);

  app.use(errorHandler);

  return app;
}
