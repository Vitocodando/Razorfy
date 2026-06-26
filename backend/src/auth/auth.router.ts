import { Router } from 'express';
import { RegisterSchema, LoginSchema, GoogleAuthSchema, Verify2faSchema, VerifyGoogleOtpSchema } from './auth.schemas';
import { register, login, loginWithGoogle, googleAuthUrl, consumePreAuthToken, verifyLogin2fa, verifyGoogleOtp } from './auth.service';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';
import { googleOAuthEnabled } from '../config';
import { z } from 'zod';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(async (req, res) => {
  const data = RegisterSchema.parse(req.body);
  const result = await register(data);
  res.status(201).json(result);
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password, tenantSlug } = LoginSchema.parse(req.body);
  const result = await login(identifier, password, tenantSlug);
  // FA01: 2FA exigido → 202 Accepted com preAuthToken; senão 200 com a sessão.
  if ('status' in result && result.status === 'REQUIRE_2FA') {
    res.status(202).json(result);
    return;
  }
  res.json(result);
}));

// FA01 passo 6/7: troca preAuthToken + código TOTP pelo JWT final.
authRouter.post('/login/verify-2fa', asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new BusinessError('PRE_AUTH_INVALID', 'Token de verificação não fornecido.', 401);
  }
  const userId = consumePreAuthToken(header.slice(7));
  const { code } = Verify2faSchema.parse(req.body);
  res.json(await verifyLogin2fa(userId, code));
}));

// Indica ao cliente se o login social está disponível neste ambiente.
authRouter.get('/google/status', (_req, res) => {
  res.json({ enabled: googleOAuthEnabled });
});

// Retorna a URL de autorização do Google para o redirect inicial.
authRouter.get('/google/url', asyncHandler(async (req, res) => {
  if (!googleOAuthEnabled) {
    throw new BusinessError('OAUTH_DISABLED', 'Login com Google não está configurado neste ambiente.', 503);
  }
  const state = z.string().min(1).parse(req.query.state);
  res.json({ url: googleAuthUrl(state) });
}));

// Troca o authorization code por uma sessão Razorfy.
authRouter.post('/google', asyncHandler(async (req, res) => {
  const { code, tenantSlug } = GoogleAuthSchema.parse(req.body);
  const result = await loginWithGoogle(code, tenantSlug);
  // FEAT-083: novo usuário → 202 pedindo validação de WhatsApp; senão 200 com a sessão.
  if ('status' in result && result.status === 'REQUIRE_WHATSAPP') {
    res.status(202).json(result);
    return;
  }
  res.json(result);
}));

// FEAT-083 Fase B: fecha o cadastro Google com o OTP do WhatsApp.
authRouter.post('/otp/verify-google', asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new BusinessError('PRE_AUTH_INVALID', 'Token de verificação não fornecido.', 401);
  }
  const { phone, code } = VerifyGoogleOtpSchema.parse(req.body);
  res.json(await verifyGoogleOtp(header.slice(7), phone, code));
}));
