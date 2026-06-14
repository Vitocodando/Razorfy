"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(...roles) {
    return (req, res, next) => {
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
