import { Request, Response, NextFunction } from 'express';

// RN02/RN13: rotas /platform/* exigem role DEV. A role vem do JWT (já validado por
// authenticate); barramos antes de qualquer leitura de tenant/banco.
export function requireDev(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Não autenticado.', path: req.path });
    return;
  }
  if (req.user.role !== 'DEV') {
    res.status(403).json({ timestamp: new Date().toISOString(), status: 403, code: 'PLATFORM_ACCESS_DENIED', message: 'Acesso restrito ao proprietário da plataforma.', path: req.path });
    return;
  }
  next();
}
