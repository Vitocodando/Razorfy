import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email().max(150),
  phone: z.string().min(10).max(20),
  password: z.string().min(6).max(100),
  tenantSlug: z.string().max(50).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().max(50).optional(),
});

export const GoogleAuthSchema = z.object({
  code: z.string().min(1),
});

// V01: código TOTP de login — 6 dígitos numéricos.
export const Verify2faSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código deve ter exatamente 6 dígitos.'),
});
