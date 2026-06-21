import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { UpdateProfileSchema, ChangePasswordSchema, DeleteAccountSchema, Enable2faSchema, Disable2faSchema } from './user.schemas';
import { getMe, updateProfile, changePassword, anonymizeAccount, setup2fa, enable2fa, disable2fa } from './user.service';

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

// FEAT-076: 2FA TOTP — setup / enable / disable da conta autenticada.
userRouter.post('/me/2fa/setup', asyncHandler(async (req, res) => {
  res.json(await setup2fa(req.user!.id));
}));

userRouter.post('/me/2fa/enable', asyncHandler(async (req, res) => {
  const { code } = Enable2faSchema.parse(req.body);
  await enable2fa(req.user!.id, code);
  res.status(204).end();
}));

userRouter.delete('/me/2fa', asyncHandler(async (req, res) => {
  const { currentPassword, code } = Disable2faSchema.parse(req.body);
  await disable2fa(req.user!.id, currentPassword, code);
  res.status(204).end();
}));
