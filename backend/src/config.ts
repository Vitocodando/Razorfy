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
  // 2FA TOTP (FEAT-076): chave-mestra AES-256-GCM (32 bytes em hex = 64 chars). Ausente => 2FA off.
  TOTP_ENC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
  CASHBACK_RATE: z.coerce.number().default(0.1),
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().default(10),
  BUSINESS_TIMEZONE: z.string().default('America/Sao_Paulo'),
  CORS_ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  WHATSAPP_GATEWAY_URL: z.string().optional(),
  // Z-API (FEAT-079): token de segurança da conta (header Client-Token).
  WHATSAPP_CLIENT_TOKEN: z.string().optional(),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().default(5),
  DEV_BOOTSTRAP_ENABLED: z.string().transform(v => v === 'true').default('false'),
  DEV_ADMIN_EMAIL: z.string().email().optional(),
  DEV_ADMIN_PASSWORD: z.string().optional(),
  DEV_STAFF_PASSWORD: z.string().optional(),
  // Usuário-mestre da plataforma (role DEV, tenant nulo). Seed no boot, nunca via endpoint.
  DEV_PLATFORM_EMAIL: z.string().email().optional(),
  DEV_PLATFORM_PASSWORD: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // Login social Google (OAuth 2.0). Opcionais: ausentes => endpoint /auth/google responde 503.
  // O client_secret é confidencial e nunca deve ser versionado.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  PORT: z.coerce.number().int().default(8080),
});

export const config = Schema.parse(process.env);

export const googleOAuthEnabled = Boolean(
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI,
);
