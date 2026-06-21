"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenant = resolveTenant;
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// RN04: rotas públicas trazem o tenant no path (:tenantId, UUID ou slug). Valida existência e atividade.
function resolveTenant(req, _res, next) {
    const key = req.params.tenantId;
    const lookup = UUID_RE.test(key)
        ? prisma_1.prisma.barbershop.findUnique({ where: { id: key } })
        : prisma_1.prisma.barbershop.findUnique({ where: { slug: key } });
    lookup
        .then(shop => {
        if (!shop)
            throw new BusinessError_1.BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
        if (!shop.isActive) {
            throw new BusinessError_1.BusinessError('TENANT_SUSPENDED', 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', 403);
        }
        req.tenantId = shop.id;
        next();
    })
        .catch(next);
}
