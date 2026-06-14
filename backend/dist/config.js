"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleOAuthEnabled = exports.config = void 0;
const zod_1 = require("zod");
// Carrega .env quando existir (dev local); em produção (Vercel/Docker) as vars já vêm do ambiente.
try {
    process.loadEnvFile();
}
catch {
    // sem arquivo .env — segue com process.env puro
}
const Schema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_CLIENT_EXPIRATION_HOURS: zod_1.z.coerce.number().default(24),
    JWT_STAFF_EXPIRATION_HOURS: zod_1.z.coerce.number().default(8),
    CASHBACK_RATE: zod_1.z.coerce.number().default(0.1),
    PAYMENT_HOLD_MINUTES: zod_1.z.coerce.number().int().default(10),
    BUSINESS_TIMEZONE: zod_1.z.string().default('America/Sao_Paulo'),
    CORS_ALLOWED_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    WHATSAPP_GATEWAY_URL: zod_1.z.string().optional(),
    NOTIFICATION_MAX_ATTEMPTS: zod_1.z.coerce.number().int().default(5),
    DEV_BOOTSTRAP_ENABLED: zod_1.z.string().transform(v => v === 'true').default('false'),
    DEV_ADMIN_EMAIL: zod_1.z.string().email().optional(),
    DEV_ADMIN_PASSWORD: zod_1.z.string().optional(),
    DEV_STAFF_PASSWORD: zod_1.z.string().optional(),
    CRON_SECRET: zod_1.z.string().optional(),
    // Login social Google (OAuth 2.0). Opcionais: ausentes => endpoint /auth/google responde 503.
    // O client_secret é confidencial e nunca deve ser versionado.
    GOOGLE_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional(),
    GOOGLE_REDIRECT_URI: zod_1.z.string().optional(),
    PORT: zod_1.z.coerce.number().int().default(8080),
});
exports.config = Schema.parse(process.env);
exports.googleOAuthEnabled = Boolean(exports.config.GOOGLE_CLIENT_ID && exports.config.GOOGLE_CLIENT_SECRET && exports.config.GOOGLE_REDIRECT_URI);
