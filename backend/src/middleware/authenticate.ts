import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../prisma';
import { AuthUser } from '../user/user.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

const DEFAULT_TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

type TokenPayload = { sub: string; roles: string[]; name: string; tnt?: string; type?: string; iat?: number };

// SEC (FEAT-088): revogação de sessão. Cache curto de users.token_valid_after por usuário,
// para não fazer 1 query por request (mesma estratégia do tenantActiveCache).
const TOKEN_REVOKE_TTL_MS = 30_000;
const tokenValidAfterCache = new Map<string, { validAfterMs: number | null; at: number }>();

export function invalidateTokenCache(userId: string): void {
  tokenValidAfterCache.delete(userId);
}

async function resolveTokenValidAfter(userId: string): Promise<number | null> {
  const cached = tokenValidAfterCache.get(userId);
  if (cached && Date.now() - cached.at < TOKEN_REVOKE_TTL_MS) return cached.validAfterMs;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tokenValidAfter: true } });
  const validAfterMs = u?.tokenValidAfter ? u.tokenValidAfter.getTime() : null;
  tokenValidAfterCache.set(userId, { validAfterMs, at: Date.now() });
  return validAfterMs;
}

// Kill-switch (FEAT-075 FA01): cache curto do status ativo do tenant para barrar
// tokens de barbearia suspensa na próxima requisição, sem 1 query por request.
const TENANT_ACTIVE_TTL_MS = 10_000;
const tenantActiveCache = new Map<string, { active: boolean; at: number }>();

export function invalidateTenantActiveCache(tenantId: string): void {
  tenantActiveCache.delete(tenantId);
}

function ensureTenantActive(tenantId: string, req: Request, res: Response, next: NextFunction): void {
  const cached = tenantActiveCache.get(tenantId);
  if (cached && Date.now() - cached.at < TENANT_ACTIVE_TTL_MS) {
    if (!cached.active) return denySuspended(res, req);
    next();
    return;
  }
  prisma.barbershop.findUnique({ where: { id: tenantId }, select: { isActive: true } })
    .then(shop => {
      const active = shop?.isActive ?? false;
      tenantActiveCache.set(tenantId, { active, at: Date.now() });
      if (!active) return denySuspended(res, req);
      next();
    })
    .catch(next);
}

function denySuspended(res: Response, req: Request): void {
  res.status(403).json({ timestamp: new Date().toISOString(), status: 403, code: 'TENANT_SUSPENDED', message: 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', path: req.path });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Token não fornecido.', path: req.path });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    // V02: tokens de pré-autenticação (2FA, Google→WhatsApp) nunca acessam rotas normais.
    if (payload.type) {
      res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'PRE_AUTH_NOT_ALLOWED', message: 'Conclua a verificação pendente.', path: req.path });
      return;
    }
    const base = { id: payload.sub, role: payload.roles[0] as AuthUser['role'], name: payload.name };

    // SEC (FEAT-088): rejeita tokens revogados (logout/troca-de-senha) antes de liberar acesso.
    resolveTokenValidAfter(payload.sub)
      .then(validAfterMs => {
        if (validAfterMs !== null && (payload.iat ?? 0) * 1000 < validAfterMs) {
          res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'SESSION_REVOKED', message: 'Sessão encerrada. Faça login novamente.', path: req.path });
          return;
        }

        // DEV (plataforma) não pertence a tenant — passa limpo, sem checagem territorial (RN13).
        if (base.role === 'DEV') {
          req.user = { ...base, tenantId: null };
          next();
          return;
        }
        if (payload.tnt) {
          req.user = { ...base, tenantId: payload.tnt };
          ensureTenantActive(payload.tnt, req, res, next);
          return;
        }
        // Token antigo sem claim de tenant: resolve via banco (anti-quebra de sessões existentes).
        return prisma.user.findUnique({ where: { id: payload.sub }, select: { tenantId: true } })
          .then(u => {
            const tid = u?.tenantId ?? DEFAULT_TENANT_ID;
            req.user = { ...base, tenantId: tid };
            ensureTenantActive(tid, req, res, next);
          });
      })
      .catch(next);
  } catch {
    res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.', path: req.path });
  }
}

// Popula req.user quando há token válido, mas não exige autenticação.
// Usado em endpoints públicos cujo retorno varia conforme a role (ex.: avaliações).
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
      req.user = { id: payload.sub, role: payload.roles[0] as AuthUser['role'], name: payload.name, tenantId: payload.tnt ?? DEFAULT_TENANT_ID };
    } catch {
      // token inválido em rota pública: segue como anônimo
    }
  }
  next();
}
