"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findActiveServices = findActiveServices;
exports.findBarbers = findBarbers;
const prisma_1 = require("../prisma");
async function findActiveServices() {
    return prisma_1.prisma.service.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
    });
}
async function findBarbers() {
    return prisma_1.prisma.user.findMany({
        where: { role: 'BARBER' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}
