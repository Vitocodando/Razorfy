"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'UNAUTHORIZED', message: 'Token não fornecido.', path: req.path });
        return;
    }
    try {
        const token = header.slice(7);
        const payload = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET, { algorithms: ['HS256'] });
        req.user = { id: payload.sub, role: payload.roles[0], name: payload.name };
        next();
    }
    catch {
        res.status(401).json({ timestamp: new Date().toISOString(), status: 401, code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.', path: req.path });
    }
}
