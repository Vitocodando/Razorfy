"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.buildOtpAuthUri = buildOtpAuthUri;
exports.verifyCode = verifyCode;
const otplib_1 = require("otplib");
// RFC 6238 (TOTP) via otplib v13 (API funcional).
// RN01: tolerância de ±30s (epochTolerance simétrico) → aceita o código anterior,
// atual e o seguinte (janela total de 90s).
const EPOCH_TOLERANCE_SECONDS = 30;
const ISSUER_BASE = 'Razorfy';
function generateSecret() {
    return (0, otplib_1.generateSecret)(); // Base32
}
// RN04: issuer carrega o nome da barbearia para identificação no app autenticador.
function buildOtpAuthUri(secret, accountEmail, tenantName) {
    const issuer = tenantName ? `${ISSUER_BASE} (${tenantName})` : ISSUER_BASE;
    return (0, otplib_1.generateURI)({ strategy: 'totp', issuer, label: accountEmail, secret });
}
function verifyCode(code, secret) {
    try {
        return (0, otplib_1.verifySync)({ token: code, secret, epochTolerance: EPOCH_TOLERANCE_SECONDS }).valid;
    }
    catch {
        return false;
    }
}
