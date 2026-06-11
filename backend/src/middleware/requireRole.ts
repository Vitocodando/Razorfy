import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../user/user.types';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Não autenticado.', path: req.path });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ timestamp: new Date().toISOString(), status: 403, code: 'FORBIDDEN', message: 'Acesso negado.', path: req.path });
      return;
    }
    next();
  };
}
