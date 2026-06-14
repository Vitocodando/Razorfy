"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../middleware/authenticate");
const asyncHandler_1 = require("../common/asyncHandler");
const prisma_1 = require("../prisma");
exports.walletRouter = (0, express_1.Router)();
exports.walletRouter.get('/wallet', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clientId = req.user.id;
    let wallet = await prisma_1.prisma.cashbackWallet.findUnique({
        where: { clientId },
        include: {
            transactions: {
                orderBy: { createdAt: 'desc' },
                take: 50,
            },
        },
    });
    if (!wallet) {
        wallet = await prisma_1.prisma.cashbackWallet.create({
            data: { clientId },
            include: { transactions: true },
        });
    }
    const availableBalance = wallet.balance.minus(wallet.reservedBalance);
    res.json({
        id: wallet.id,
        balance: wallet.balance,
        reservedBalance: wallet.reservedBalance,
        availableBalance,
        transactions: wallet.transactions,
    });
}));
