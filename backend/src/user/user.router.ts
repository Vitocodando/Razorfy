import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { UpdateProfileSchema, ChangePasswordSchema, DeleteAccountSchema } from './user.schemas';
import { getMe, updateProfile, changePassword, anonymizeAccount } from './user.service';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/me', asyncHandler(async (req, res) => {
  res.json(await getMe(req.user!.id));
}));

// RF01: atualiza perfil/preferências do usuário autenticado (id do JWT).
userRouter.patch('/me', asyncHandler(async (req, res) => {
  const data = UpdateProfileSchema.parse(req.body);
  res.json(await updateProfile(req.user!.id, data));
}));

// RF02: troca de senha.
userRouter.put('/me/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
  await changePassword(req.user!.id, currentPassword, newPassword);
  res.status(204).end();
}));

// RF03: exclusão (anonimização LGPD) do próprio cliente.
userRouter.delete('/me', asyncHandler(async (req, res) => {
  const { currentPassword } = DeleteAccountSchema.parse(req.body);
  await anonymizeAccount(req.user!.id, currentPassword);
  res.status(204).end();
}));
