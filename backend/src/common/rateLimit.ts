import rateLimit from 'express-rate-limit';

// SEC: proteção contra brute-force/DoS. Requer `app.set('trust proxy', 1)` no app.ts
// para ler o IP real por trás do proxy do Render (senão todos compartilham o IP do LB).

// Rotas de credencial/OTP: janela estreita por IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 min
  max: 10,               // 10 tentativas por IP por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// Limite global suave (anti-scraping / DoS leve). Não afeta uso normal.
export const globalLimiter = rateLimit({
  windowMs: 60_000, // 1 min
  max: 120,         // 120 req por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Excesso de requisições. Aguarde um momento.' },
});
