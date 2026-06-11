import { Router } from 'express';
import { RegisterSchema, LoginSchema } from './auth.schemas';
import { register, login } from './auth.service';
import { asyncHandler } from '../common/asyncHandler';

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
