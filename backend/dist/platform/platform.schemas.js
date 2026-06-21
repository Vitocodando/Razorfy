"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantStatusSchema = exports.CreateTenantSchema = exports.ListTenantsQuery = void 0;
const zod_1 = require("zod");
exports.ListTenantsQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(0).default(0),
    size: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.CreateTenantSchema = zod_1.z.object({
    tenant: zod_1.z.object({
        name: zod_1.z.string().trim().min(2).max(100),
        slug: zod_1.z.string().trim().toLowerCase().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífen.'),
        connectionCode: zod_1.z.string().trim().toUpperCase().min(3).max(10).regex(/^[A-Z0-9]+$/, 'Código deve conter apenas letras e números.'),
    }),
    adminUser: zod_1.z.object({
        name: zod_1.z.string().trim().min(2).max(100),
        email: zod_1.z.string().trim().email().max(150),
        phone: zod_1.z.string().trim().min(8).max(20),
        initialPassword: zod_1.z.string().min(8).max(72),
    }),
});
exports.TenantStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
