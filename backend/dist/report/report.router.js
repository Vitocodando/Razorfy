"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../middleware/authenticate");
const requireRole_1 = require("../middleware/requireRole");
const asyncHandler_1 = require("../common/asyncHandler");
const prisma_1 = require("../prisma");
exports.reportRouter = (0, express_1.Router)();
exports.reportRouter.get('/reports/summary', authenticate_1.authenticate, (0, requireRole_1.requireRole)('ADMIN', 'DEV'), (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const [appointmentStats, walletStats] = await Promise.all([
        prisma_1.prisma.$queryRaw `
        SELECT status, COUNT(*) as count, COALESCE(SUM(amount_paid), 0)::text as total
        FROM appointments
        GROUP BY status
        ORDER BY status
      `,
        prisma_1.prisma.$queryRaw `
        SELECT COALESCE(SUM(balance), 0)::text as total_balance,
               COALESCE(SUM(reserved_balance), 0)::text as total_reserved
        FROM cashback_wallets
      `,
    ]);
    res.json({
        appointments: appointmentStats.map(r => ({
            status: r.status,
            count: Number(r.count),
            total: r.total,
        })),
        wallet: walletStats[0] ?? { total_balance: '0', total_reserved: '0' },
    });
}));
