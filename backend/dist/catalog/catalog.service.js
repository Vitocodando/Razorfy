"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TENANT_ID = void 0;
exports.findActiveServices = findActiveServices;
exports.findBarbers = findBarbers;
const prisma_1 = require("../prisma");
exports.DEFAULT_TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
async function findActiveServices(tenantId = exports.DEFAULT_TENANT_ID) {
    return prisma_1.prisma.service.findMany({
        where: { tenantId, active: true },
        orderBy: { name: 'asc' },
    });
}
async function findBarbers(tenantId = exports.DEFAULT_TENANT_ID) {
    return prisma_1.prisma.user.findMany({
        where: { tenantId, role: 'BARBER', isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}
