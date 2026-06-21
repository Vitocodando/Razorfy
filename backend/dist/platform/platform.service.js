"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenants = listTenants;
exports.createTenant = createTenant;
exports.setTenantStatus = setTenantStatus;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
const authenticate_1 = require("../middleware/authenticate");
// RF01: listagem global paginada de tenants + contato do admin (dono).
async function listTenants(page, size) {
    const [totalElements, shops] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.barbershop.count(),
        prisma_1.prisma.barbershop.findMany({
            orderBy: { createdAt: 'desc' },
            skip: page * size,
            take: size,
            select: { id: true, name: true, connectionCode: true, isActive: true, createdAt: true },
        }),
    ]);
    // Contato do dono (primeiro ADMIN de cada tenant) — busca única evita N+1.
    const ids = shops.map(s => s.id);
    const admins = ids.length
        ? await prisma_1.prisma.user.findMany({
            where: { tenantId: { in: ids }, role: 'ADMIN' },
            orderBy: { createdAt: 'asc' },
            select: { tenantId: true, name: true, email: true, phone: true },
        })
        : [];
    const adminByTenant = new Map();
    for (const a of admins) {
        if (a.tenantId && !adminByTenant.has(a.tenantId)) {
            adminByTenant.set(a.tenantId, { name: a.name, email: a.email, phone: a.phone });
        }
    }
    return {
        content: shops.map(s => ({
            tenantId: s.id,
            name: s.name,
            connectionCode: s.connectionCode,
            isActive: s.isActive,
            createdAt: s.createdAt,
            adminContact: adminByTenant.get(s.id) ?? null,
        })),
        totalPages: Math.ceil(totalElements / size),
        totalElements,
    };
}
// RF02/RN03: onboarding transacional — barbearia + usuário-mestre (ADMIN) atômicos.
async function createTenant(input) {
    const { tenant, adminUser } = input;
    // V03: connection_code único em TODA a tabela (ativo ou inativo).
    const dupCode = await prisma_1.prisma.barbershop.findUnique({ where: { connectionCode: tenant.connectionCode } });
    if (dupCode) {
        throw new BusinessError_1.BusinessError('DUPLICATE_CONNECTION_CODE', `O código de conexão "${tenant.connectionCode}" já está em uso.`, 422);
    }
    const dupSlug = await prisma_1.prisma.barbershop.findUnique({ where: { slug: tenant.slug } });
    if (dupSlug) {
        throw new BusinessError_1.BusinessError('DUPLICATE_SLUG', `O identificador (slug) "${tenant.slug}" já está em uso.`, 422);
    }
    const hash = await bcrypt_1.default.hash(adminUser.initialPassword, 12);
    try {
        const shop = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.barbershop.create({
                data: { name: tenant.name, slug: tenant.slug, connectionCode: tenant.connectionCode },
            });
            // V01: role forçada para ADMIN; V02: e-mail único sob o tenant recém-criado.
            await tx.user.create({
                data: {
                    name: adminUser.name,
                    email: adminUser.email.toLowerCase(),
                    phone: adminUser.phone,
                    password: hash,
                    role: 'ADMIN',
                    tenantId: created.id,
                },
            });
            return created;
        });
        return {
            tenantId: shop.id,
            message: 'Barbearia e Usuário Mestre criados com sucesso.',
            tenant: { name: shop.name, connectionCode: shop.connectionCode, isActive: shop.isActive },
        };
    }
    catch (err) {
        // Conflitos de unicidade conhecidos (corrida) → 422; demais falhas → rollback + 500.
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new BusinessError_1.BusinessError('ONBOARDING_TRANSACTION_FAILED', 'Conflito de dados ao criar o usuário-mestre. A criação foi cancelada.', 422);
        }
        throw new BusinessError_1.BusinessError('ONBOARDING_TRANSACTION_FAILED', 'Falha ao criar o usuário-mestre. A barbearia não foi criada.', 500);
    }
}
// RF03/FA01: kill-switch — alterna is_active e invalida o cache (efeito imediato).
async function setTenantStatus(tenantId, isActive) {
    const shop = await prisma_1.prisma.barbershop.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!shop)
        throw new BusinessError_1.BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
    const updated = await prisma_1.prisma.barbershop.update({
        where: { id: tenantId },
        data: { isActive },
        select: { id: true, name: true, connectionCode: true, isActive: true },
    });
    (0, authenticate_1.invalidateTenantActiveCache)(tenantId);
    return { tenantId: updated.id, name: updated.name, connectionCode: updated.connectionCode, isActive: updated.isActive };
}
