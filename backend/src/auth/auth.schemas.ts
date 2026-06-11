import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email().max(150),
  phone: z.string().min(10).max(20),
  password: z.string().min(6).max(100),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
