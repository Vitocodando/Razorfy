import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// RN04: rotas públicas trazem o tenant no path (:tenantId, UUID ou slug). Valida existência e atividade.
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const key = req.params.tenantId;
  const lookup = UUID_RE.test(key)
    ? prisma.barbershop.findUnique({ where: { id: key } })
    : prisma.barbershop.findUnique({ where: { slug: key } });

  lookup
    .then(shop => {
      if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
      if (!shop.isActive) {
        throw new BusinessError('TENANT_SUSPENDED', 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', 403);
      }
      req.tenantId = shop.id;
      next();
    })
    .catch(next);
}
