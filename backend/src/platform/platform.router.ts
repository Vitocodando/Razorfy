import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireDev } from './platform.middleware';
import { asyncHandler } from '../common/asyncHandler';
import { CreateTenantSchema, ListTenantsQuery, TenantStatusSchema } from './platform.schemas';
import { createTenant, listTenants, setTenantStatus } from './platform.service';

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
