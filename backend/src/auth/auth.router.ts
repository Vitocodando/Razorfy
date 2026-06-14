import { Router } from 'express';
import { RegisterSchema, LoginSchema, GoogleAuthSchema } from './auth.schemas';
import { register, login, loginWithGoogle, googleAuthUrl } from './auth.service';
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
  const { email, password } = LoginSchema.parse(req.body);
  const result = await login(email, password);
  res.json(result);
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
  const { code } = GoogleAuthSchema.parse(req.body);
  const result = await loginWithGoogle(code);
  res.json(result);
}));
