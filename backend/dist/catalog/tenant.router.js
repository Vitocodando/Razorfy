"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantRouter = exports.barbershopRouter = void 0;
const express_1 = require("express");
const catalog_service_1 = require("./catalog.service");
const availability_service_1 = require("../schedule/availability.service");
const resolveTenant_1 = require("../middleware/resolveTenant");
const asyncHandler_1 = require("../common/asyncHandler");
const BusinessError_1 = require("../common/BusinessError");
const prisma_1 = require("../prisma");
// Discovery público de barbearias: /api/v1/barbershops?q=...
exports.barbershopRouter = (0, express_1.Router)();
exports.barbershopRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const shops = await prisma_1.prisma.barbershop.findMany({
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
exports.barbershopRouter.get('/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const shop = await prisma_1.prisma.barbershop.findUnique({
        where: { slug: req.params.slug },
        select: { id: true, name: true, slug: true, isActive: true },
    });
    if (!shop)
        throw new BusinessError_1.BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
    if (!shop.isActive)
        throw new BusinessError_1.BusinessError('TENANT_SUSPENDED', 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', 403);
    res.json(shop);
}));
// Rotas públicas contextualizadas por tenant (RN04): /api/v1/tenants/:tenantId/...
exports.tenantRouter = (0, express_1.Router)();
// Conexão por código (QR/manual). Registrado antes do middleware de :tenantId.
exports.tenantRouter.get('/connect/:code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(code)) {
        throw new BusinessError_1.BusinessError('BAD_REQUEST_FORMAT', 'O código deve conter apenas letras e números.', 400);
    }
    const shop = await prisma_1.prisma.barbershop.findUnique({
        where: { connectionCode: code },
        select: { id: true, name: true, slug: true, connectionCode: true, logoUrl: true, isActive: true },
    });
    if (!shop) {
        throw new BusinessError_1.BusinessError('INVALID_CONNECTION_CODE', 'Código de conexão não encontrado. Verifique se você digitou corretamente.', 404);
    }
    if (!shop.isActive) {
        throw new BusinessError_1.BusinessError('TENANT_INACTIVE', 'Esta barbearia encontra-se temporariamente suspensa e não pode receber novos acessos.', 403);
    }
    res.json({ tenantId: shop.id, name: shop.name, slug: shop.slug, connectionCode: shop.connectionCode, logoUrl: shop.logoUrl });
}));
exports.tenantRouter.use('/:tenantId', resolveTenant_1.resolveTenant);
exports.tenantRouter.get('/:tenantId/services', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, catalog_service_1.findActiveServices)(req.tenantId));
}));
exports.tenantRouter.get('/:tenantId/barbers', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, catalog_service_1.findBarbers)(req.tenantId));
}));
exports.tenantRouter.get('/:tenantId/barbers/:id/availability', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date, duration } = req.query;
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BusinessError_1.BusinessError('INVALID_INPUT', 'O parâmetro date é obrigatório (YYYY-MM-DD).', 400);
    }
    const durationMinutes = duration ? parseInt(String(duration), 10) : 0;
    if (!durationMinutes || isNaN(durationMinutes)) {
        throw new BusinessError_1.BusinessError('INVALID_INPUT', 'O parâmetro duration é obrigatório e deve ser um inteiro positivo.', 400);
    }
    const slots = await (0, availability_service_1.availableStarts)(req.params.id, date, durationMinutes, req.tenantId);
    res.json({ availableStarts: slots.map(d => d.toISOString()) });
}));
