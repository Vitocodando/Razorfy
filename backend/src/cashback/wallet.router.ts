import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../common/asyncHandler';
import { prisma } from '../prisma';

export const walletRouter = Router();

walletRouter.get('/wallet', authenticate, asyncHandler(async (req, res) => {
  const clientId = req.user!.id;

  let wallet = await prisma.cashbackWallet.findUnique({
    where: { clientId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.cashbackWallet.create({
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
