import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser } from '../user/user.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Token não fornecido.', path: req.path });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      sub: string;
      roles: string[];
      name: string;
    };
    req.user = { id: payload.sub, role: payload.roles[0] as AuthUser['role'], name: payload.name };
    next();
  } catch {
    res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.', path: req.path });
  }
}
