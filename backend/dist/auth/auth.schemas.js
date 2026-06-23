"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Verify2faSchema = exports.GoogleAuthSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
// FEAT-078: credencial = identifier (e-mail OU telefone).
exports.RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(100),
    identifier: zod_1.z.string().min(3).max(150),
    password: zod_1.z.string().min(6).max(100),
    tenantSlug: zod_1.z.string().max(50).optional(),
});
exports.LoginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(3).max(150),
    password: zod_1.z.string().min(1),
    tenantSlug: zod_1.z.string().max(50).optional(),
});
exports.GoogleAuthSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
});
// V01: código TOTP de login — 6 dígitos numéricos.
exports.Verify2faSchema = zod_1.z.object({
    code: zod_1.z.string().regex(/^\d{6}$/, 'O código deve ter exatamente 6 dígitos.'),
});
