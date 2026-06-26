import { z } from 'zod';

// FEAT-078: credencial = identifier (e-mail OU telefone).
export const RegisterSchema = z.object({
  name: z.string().min(3).max(100),
  identifier: z.string().min(3).max(150),
  password: z.string().min(6).max(100),
  tenantSlug: z.string().max(50).optional(),
});

export const LoginSchema = z.object({
  identifier: z.string().min(3).max(150),
  password: z.string().min(1),
  tenantSlug: z.string().max(50).optional(),
});

export const GoogleAuthSchema = z.object({
  code: z.string().min(1),
  tenantSlug: z.string().max(50).optional(),
});

// FEAT-083: fecha o cadastro Google com o OTP do WhatsApp.
export const VerifyGoogleOtpSchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/, 'O código deve ter exatamente 6 dígitos.'),
});

// V01: código TOTP de login — 6 dígitos numéricos.
export const Verify2faSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código deve ter exatamente 6 dígitos.'),
});
