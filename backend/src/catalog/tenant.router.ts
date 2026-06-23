import { Router } from 'express';
import { z } from 'zod';
import { findActiveServices, findBarbers } from './catalog.service';
import { availableStarts } from '../schedule/availability.service';
import { resolveTenant } from '../middleware/resolveTenant';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';
import { prisma } from '../prisma';
import { sendOtp, verifyOtp } from '../auth/otp.service';

// FEAT-077: schemas OTP por telefone.
const OtpSendSchema = z.object({ phone: z.string().min(8).max(20) });
const OtpVerifySchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/, 'O código deve ter exatamente 6 dígitos.'),
  name: z.string().trim().min(2).max(100).optional(),
});

// Discovery público de barbearias: /api/v1/barbershops?q=...
export const barbershopRouter = Router();

barbershopRouter.get('/', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const shops = await prisma.barbershop.findMany({
    where: {
      isActive: true,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
    take: 50,
  });
  res.json(shops);
}));

barbershopRouter.get('/:slug', asyncHandler(async (req, res) => {
  const shop = await prisma.barbershop.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
  if (!shop.isActive) throw new BusinessError('TENANT_SUSPENDED', 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', 403);
  res.json(shop);
}));

// Rotas públicas contextualizadas por tenant (RN04): /api/v1/tenants/:tenantId/...
export const tenantRouter = Router();

// Conexão por código (QR/manual). Registrado antes do middleware de :tenantId.
tenantRouter.get('/connect/:code', asyncHandler(async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code)) {
    throw new BusinessError('BAD_REQUEST_FORMAT', 'O código deve conter apenas letras e números.', 400);
  }
  const shop = await prisma.barbershop.findUnique({
    where: { connectionCode: code },
    select: { id: true, name: true, slug: true, connectionCode: true, logoUrl: true, isActive: true },
  });
  if (!shop) {
    throw new BusinessError('INVALID_CONNECTION_CODE', 'Código de conexão não encontrado. Verifique se você digitou corretamente.', 404);
  }
  if (!shop.isActive) {
    throw new BusinessError('TENANT_INACTIVE', 'Esta barbearia encontra-se temporariamente suspensa e não pode receber novos acessos.', 403);
  }
  res.json({ tenantId: shop.id, name: shop.name, slug: shop.slug, connectionCode: shop.connectionCode, logoUrl: shop.logoUrl });
}));

tenantRouter.use('/:tenantId', resolveTenant);

// FEAT-077: autenticação por telefone (OTP). resolveTenant garante tenant existente/ativo.
tenantRouter.post('/:tenantId/auth/otp/send', asyncHandler(async (req, res) => {
  const { phone } = OtpSendSchema.parse(req.body);
  res.json(await sendOtp(req.tenantId!, phone));
}));

tenantRouter.post('/:tenantId/auth/otp/verify', asyncHandler(async (req, res) => {
  const { phone, code, name } = OtpVerifySchema.parse(req.body);
  res.json(await verifyOtp(req.tenantId!, phone, code, name));
}));

tenantRouter.get('/:tenantId/services', asyncHandler(async (req, res) => {
  res.json(await findActiveServices(req.tenantId!));
}));

tenantRouter.get('/:tenantId/barbers', asyncHandler(async (req, res) => {
  res.json(await findBarbers(req.tenantId!));
}));

tenantRouter.get('/:tenantId/barbers/:id/availability', asyncHandler(async (req, res) => {
  const { date, duration } = req.query;
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro date é obrigatório (YYYY-MM-DD).', 400);
  }
  const durationMinutes = duration ? parseInt(String(duration), 10) : 0;
  if (!durationMinutes || isNaN(durationMinutes)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro duration é obrigatório e deve ser um inteiro positivo.', 400);
  }
  const slots = await availableStarts(req.params.id, date, durationMinutes, req.tenantId!);
  res.json({ availableStarts: slots.map(d => d.toISOString()) });
}));
