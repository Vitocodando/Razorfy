"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateTenantActiveCache = invalidateTenantActiveCache;
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const prisma_1 = require("../prisma");
const DEFAULT_TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
// Kill-switch (FEAT-075 FA01): cache curto do status ativo do tenant para barrar
// tokens de barbearia suspensa na próxima requisição, sem 1 query por request.
const TENANT_ACTIVE_TTL_MS = 10_000;
const tenantActiveCache = new Map();
function invalidateTenantActiveCache(tenantId) {
    tenantActiveCache.delete(tenantId);
}
function ensureTenantActive(tenantId, req, res, next) {
    const cached = tenantActiveCache.get(tenantId);
    if (cached && Date.now() - cached.at < TENANT_ACTIVE_TTL_MS) {
        if (!cached.active)
            return denySuspended(res, req);
        next();
        return;
    }
    prisma_1.prisma.barbershop.findUnique({ where: { id: tenantId }, select: { isActive: true } })
        .then(shop => {
        const active = shop?.isActive ?? false;
        tenantActiveCache.set(tenantId, { active, at: Date.now() });
        if (!active)
            return denySuspended(res, req);
        next();
    })
        .catch(next);
}
function denySuspended(res, req) {
    res.status(403).json({ timestamp: new Date().toISOString(), status: 403, code: 'TENANT_SUSPENDED', message: 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', path: req.path });
}
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Token não fornecido.', path: req.path });
        return;
    }
    try {
        const token = header.slice(7);
        const payload = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET, { algorithms: ['HS256'] });
        // V02: token de pré-autenticação (2FA) nunca acessa rotas normais.
        if (payload.type === 'PRE_AUTH') {
            res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'PRE_AUTH_NOT_ALLOWED', message: 'Conclua a verificação em duas etapas.', path: req.path });
            return;
        }
        const base = { id: payload.sub, role: payload.roles[0], name: payload.name };
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
        prisma_1.prisma.user.findUnique({ where: { id: payload.sub }, select: { tenantId: true } })
            .then(u => {
            const tid = u?.tenantId ?? DEFAULT_TENANT_ID;
            req.user = { ...base, tenantId: tid };
            ensureTenantActive(tid, req, res, next);
        })
            .catch(next);
    }
    catch {
        res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.', path: req.path });
    }
}
// Popula req.user quando há token válido, mas não exige autenticação.
// Usado em endpoints públicos cujo retorno varia conforme a role (ex.: avaliações).
function optionalAuthenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        try {
            const payload = jsonwebtoken_1.default.verify(header.slice(7), config_1.config.JWT_SECRET, { algorithms: ['HS256'] });
            req.user = { id: payload.sub, role: payload.roles[0], name: payload.name, tenantId: payload.tnt ?? DEFAULT_TENANT_ID };
        }
        catch {
            // token inválido em rota pública: segue como anônimo
        }
    }
    next();
}
