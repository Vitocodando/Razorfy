import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireDev } from './platform.middleware';
import { asyncHandler } from '../common/asyncHandler';
import { CreateTenantSchema, ListTenantsQuery, TenantStatusSchema, PageQuery, SearchUsersQuery, UpdateUserSchema } from './platform.schemas';
import { createTenant, listTenants, setTenantStatus, listTenantUsers, searchUsers, updateUser, forcePasswordReset, deleteTenant } from './platform.service';
import { BusinessError } from '../common/BusinessError';

// Backoffice mestre (FEAT-075): /api/v1/platform/* — exclusivo role DEV.
export const platformRouter = Router();

platformRouter.use(authenticate, requireDev);

const UuidParam = z.string().uuid();

// RF01
platformRouter.get('/tenants', asyncHandler(async (req, res) => {
  const { page, size } = ListTenantsQuery.parse(req.query);
  res.json(await listTenants(page, size));
}));

// RF02
platformRouter.post('/tenants', asyncHandler(async (req, res) => {
  const body = CreateTenantSchema.parse(req.body);
  res.status(201).json(await createTenant(body));
}));

// RF03 (kill-switch)
platformRouter.patch('/tenants/:tenantId/status', asyncHandler(async (req, res) => {
  const tenantId = UuidParam.parse(req.params.tenantId);
  const { isActive } = TenantStatusSchema.parse(req.body);
  res.json(await setTenantStatus(tenantId, isActive));
}));

// FEAT-084: gestão global de usuários.
platformRouter.get('/tenants/:tenantId/users', asyncHandler(async (req, res) => {
  const tenantId = UuidParam.parse(req.params.tenantId);
  const { page, size } = PageQuery.parse(req.query);
  res.json(await listTenantUsers(tenantId, page, size));
}));

platformRouter.get('/users/search', asyncHandler(async (req, res) => {
  const { q } = SearchUsersQuery.parse(req.query);
  res.json(await searchUsers(q));
}));

platformRouter.put('/users/:userId', asyncHandler(async (req, res) => {
  const userId = UuidParam.parse(req.params.userId);
  const body = UpdateUserSchema.parse(req.body);
  res.json(await updateUser(userId, body));
}));

platformRouter.post('/users/:userId/force-password-reset', asyncHandler(async (req, res) => {
  const userId = UuidParam.parse(req.params.userId);
  res.json(await forcePasswordReset(userId));
}));

// FEAT-085: exclusão permanente de tenant, exige código 2FA do DEV no header X-DEV-2FA.
platformRouter.delete('/tenants/:tenantId', asyncHandler(async (req, res) => {
  const tenantId = UuidParam.parse(req.params.tenantId);
  const code = req.header('X-DEV-2FA');
  // V01: header presente, numérico, 6 dígitos — validado antes de tocar o banco.
  if (!code || !/^\d{6}$/.test(code)) {
    throw new BusinessError('INVALID_DEV_2FA_CODE', 'Informe o código de 6 dígitos do seu app de autenticação no header X-DEV-2FA.', 401);
  }
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  await deleteTenant(req.user!.id, tenantId, code, ip);
  res.status(204).end();
}));
