import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../common/asyncHandler';
import { prisma } from '../prisma';

export const reportRouter = Router();

reportRouter.get(
  '/reports/summary',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  asyncHandler(async (_req, res) => {
    const [appointmentStats, walletStats] = await Promise.all([
      prisma.$queryRaw<Array<{ status: string; count: bigint; total: string }>>`
        SELECT status, COUNT(*) as count, COALESCE(SUM(amount_paid), 0)::text as total
        FROM appointments
        GROUP BY status
        ORDER BY status
      `,
      prisma.$queryRaw<Array<{ total_balance: string; total_reserved: string }>>`
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
  }),
);
