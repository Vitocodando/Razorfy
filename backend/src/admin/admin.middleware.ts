import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export function requireStrictAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      timestamp: new Date().toISOString(),
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Não autenticado.',
      path: req.path,
    });
    return;
  }

  prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true },
  }).then(admin => {
    if (!admin || admin.role !== 'ADMIN') {
      res.status(403).json({
        timestamp: new Date().toISOString(),
        status: 403,
        error: 'Forbidden',
        code: 'ACCESS_DENIED',
        message: 'Acesso restrito a administradores.',
        path: req.path,
      });
      return;
    }
    next();
  }).catch(next);
}
