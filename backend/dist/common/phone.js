"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeE164 = normalizeE164;
exports.classifyIdentifier = classifyIdentifier;
const BusinessError_1 = require("./BusinessError");
// V01/RF03 (FEAT-077): normaliza para E.164 (assume +55 Brasil quando sem DDI).
function normalizeE164(raw) {
    let digits = raw.replace(/\D/g, '');
    if (!raw.trim().startsWith('+') && digits.length <= 11) {
        digits = '55' + digits; // adiciona Brasil
    }
    if (digits.length < 12 || digits.length > 13) {
        throw new BusinessError_1.BusinessError('INVALID_PHONE', 'Número de telefone inválido.', 422);
    }
    return '+' + digits;
}
// Classifica um identificador como e-mail ou telefone (login/registro — FEAT-078).
function classifyIdentifier(identifier) {
    const t = identifier.trim();
    if (t.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
            throw new BusinessError_1.BusinessError('INVALID_IDENTIFIER', 'Informe um e-mail ou telefone válido.', 422);
        }
        return { email: t.toLowerCase() };
    }
    return { phone: normalizeE164(t) };
}
