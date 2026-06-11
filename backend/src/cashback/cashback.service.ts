import { Prisma, PrismaClient } from '@prisma/client';
import { BusinessError } from '../common/BusinessError';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface WalletRow {
  id: string;
  clientId: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  version: bigint;
}

export async function lockWallet(tx: Tx, clientId: string): Promise<WalletRow> {
  const rows = await (tx as PrismaClient).$queryRaw<WalletRow[]>`
    SELECT id, client_id as "clientId", balance, reserved_balance as "reservedBalance", version
    FROM cashback_wallets WHERE client_id = ${clientId}::uuid FOR UPDATE
  `;
  if (rows.length > 0) return rows[0];

  // Create wallet if not exists
  const created = await tx.cashbackWallet.create({
    data: { clientId },
  });
  return {
    id: created.id,
    clientId: created.clientId,
    balance: created.balance,
    reservedBalance: created.reservedBalance,
    version: created.version,
  };
}

export async function reserve(
  tx: Tx,
  wallet: WalletRow,
  appointmentId: string,
  amount: Prisma.Decimal,
) {
  if (amount.equals(0)) return;
  const available = wallet.balance.minus(wallet.reservedBalance);
  if (amount.greaterThan(available)) {
    throw new BusinessError(
      'CASHBACK_INSUFFICIENT_FUNDS',
      `O valor de cashback solicitado (${amount.toFixed(2)}) é maior do que o saldo disponível da carteira (${available.toFixed(2)}).`,
      422,
    );
  }
  const newReserved = wallet.reservedBalance.plus(amount);
  await updateWallet(tx, wallet, wallet.balance, newReserved);
  const balanceAfter = wallet.balance.minus(newReserved);
  await insertTransaction(tx, wallet.id, appointmentId, 'RESERVE', amount, balanceAfter, 'Reserva para agendamento');
  wallet.reservedBalance = newReserved;
}

export async function debitReserved(
  tx: Tx,
  wallet: WalletRow,
  appointmentId: string,
  amount: Prisma.Decimal,
) {
  if (amount.equals(0)) return;
  const newBalance = wallet.balance.minus(amount);
  const newReserved = wallet.reservedBalance.minus(amount);
  await updateWallet(tx, wallet, newBalance, newReserved);
  await insertTransaction(tx, wallet.id, appointmentId, 'DEBIT', amount, newBalance, 'Cashback utilizado no pagamento');
  wallet.balance = newBalance;
  wallet.reservedBalance = newReserved;
}

export async function release(
  tx: Tx,
  wallet: WalletRow,
  appointmentId: string,
  amount: Prisma.Decimal,
) {
  if (amount.equals(0)) return;
  const newReserved = wallet.reservedBalance.minus(amount);
  await updateWallet(tx, wallet, wallet.balance, newReserved);
  const balanceAfter = wallet.balance.minus(newReserved);
  await insertTransaction(tx, wallet.id, appointmentId, 'RELEASE', amount, balanceAfter, 'Reserva liberada');
  wallet.reservedBalance = newReserved;
}

export async function refund(
  tx: Tx,
  wallet: WalletRow,
  appointmentId: string,
  amount: Prisma.Decimal,
) {
  if (amount.equals(0)) return;
  const newBalance = wallet.balance.plus(amount);
  await updateWallet(tx, wallet, newBalance, wallet.reservedBalance);
  await insertTransaction(tx, wallet.id, appointmentId, 'CREDIT', amount, newBalance, 'Cashback devolvido por cancelamento');
  wallet.balance = newBalance;
}

export async function creditEarned(
  tx: Tx,
  wallet: WalletRow,
  appointmentId: string,
  amountPaid: Prisma.Decimal,
  cashbackRate: number,
): Promise<Prisma.Decimal> {
  const earned = amountPaid.mul(cashbackRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (earned.equals(0)) return earned;
  const newBalance = wallet.balance.plus(earned);
  await updateWallet(tx, wallet, newBalance, wallet.reservedBalance);
  await insertTransaction(tx, wallet.id, appointmentId, 'CREDIT', earned, newBalance, 'Cashback por serviço concluído');
  wallet.balance = newBalance;
  return earned;
}

async function updateWallet(
  tx: Tx,
  wallet: WalletRow,
  newBalance: Prisma.Decimal,
  newReserved: Prisma.Decimal,
) {
  const result = await (tx as PrismaClient).$executeRaw`
    UPDATE cashback_wallets
    SET balance = ${newBalance}, reserved_balance = ${newReserved}, version = version + 1
    WHERE id = ${wallet.id}::uuid AND version = ${wallet.version}
  `;
  if (result === 0) {
    throw new BusinessError('WALLET_CONFLICT', 'Modificação concorrente na carteira. Tente novamente.', 409);
  }
  wallet.version = wallet.version + BigInt(1);
}

async function insertTransaction(
  tx: Tx,
  walletId: string,
  appointmentId: string,
  type: string,
  amount: Prisma.Decimal,
  balanceAfter: Prisma.Decimal,
  description: string,
) {
  await tx.cashbackTransaction.create({
    data: { walletId, appointmentId, type, amount, balanceAfter, description },
  });
}
