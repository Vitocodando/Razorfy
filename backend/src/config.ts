import { z } from 'zod';

// Carrega .env quando existir (dev local); em produção (Vercel/Docker) as vars já vêm do ambiente.
try {
  process.loadEnvFile();
} catch {
  // sem arquivo .env — segue com process.env puro
}

const Schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_CLIENT_EXPIRATION_HOURS: z.coerce.number().default(24),
  JWT_STAFF_EXPIRATION_HOURS: z.coerce.number().default(8),
  CASHBACK_RATE: z.coerce.number().default(0.1),
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().default(10),
  BUSINESS_TIMEZONE: z.string().default('America/Sao_Paulo'),
  CORS_ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  WHATSAPP_GATEWAY_URL: z.string().optional(),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().default(5),
  DEV_BOOTSTRAP_ENABLED: z.string().transform(v => v === 'true').default('false'),
  DEV_ADMIN_EMAIL: z.string().email().optional(),
  DEV_ADMIN_PASSWORD: z.string().optional(),
  DEV_STAFF_PASSWORD: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().default(8080),
});

export const config = Schema.parse(process.env);
