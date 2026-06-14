"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.devBootstrap = devBootstrap;
const bcrypt_1 = __importDefault(require("bcrypt"));
const config_1 = require("../config");
const prisma_1 = require("../prisma");
async function devBootstrap() {
    if (!config_1.config.DEV_BOOTSTRAP_ENABLED)
        return;
    const { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, DEV_STAFF_PASSWORD } = config_1.config;
    if (DEV_ADMIN_EMAIL && DEV_ADMIN_PASSWORD) {
        const exists = await prisma_1.prisma.user.findFirst({
            where: { email: { equals: DEV_ADMIN_EMAIL, mode: 'insensitive' } },
        });
        if (!exists) {
            const hash = await bcrypt_1.default.hash(DEV_ADMIN_PASSWORD, 12);
            await prisma_1.prisma.user.create({
                data: {
                    name: 'Administrador Razorfy',
                    email: DEV_ADMIN_EMAIL.toLowerCase(),
                    phone: '+5511999990099',
                    password: hash,
                    role: 'ADMIN',
                },
            });
            console.log(`[bootstrap] admin criado: ${DEV_ADMIN_EMAIL}`);
        }
    }
    if (DEV_STAFF_PASSWORD) {
        const hash = await bcrypt_1.default.hash(DEV_STAFF_PASSWORD, 12);
        const barbers = await prisma_1.prisma.user.findMany({ where: { role: 'BARBER' } });
        for (const barber of barbers) {
            await prisma_1.prisma.user.update({ where: { id: barber.id }, data: { password: hash } });
        }
        if (barbers.length > 0) {
            console.log(`[bootstrap] senha de ${barbers.length} barbeiro(s) atualizada`);
        }
    }
}
