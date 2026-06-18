"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStrictAdmin = requireStrictAdmin;
const prisma_1 = require("../prisma");
function requireStrictAdmin(req, res, next) {
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
    prisma_1.prisma.user.findUnique({
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
