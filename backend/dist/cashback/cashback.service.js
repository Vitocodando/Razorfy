"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockWallet = lockWallet;
exports.reserve = reserve;
exports.debitReserved = debitReserved;
exports.release = release;
exports.refund = refund;
exports.creditEarned = creditEarned;
const client_1 = require("@prisma/client");
const BusinessError_1 = require("../common/BusinessError");
async function lockWallet(tx, clientId) {
    const rows = await tx.$queryRaw `
    SELECT id, client_id as "clientId", balance, reserved_balance as "reservedBalance", version
    FROM cashback_wallets WHERE client_id = ${clientId}::uuid FOR UPDATE
  `;
    if (rows.length > 0)
        return rows[0];
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
async function reserve(tx, wallet, appointmentId, amount) {
    if (amount.equals(0))
        return;
    const available = wallet.balance.minus(wallet.reservedBalance);
    if (amount.greaterThan(available)) {
        throw new BusinessError_1.BusinessError('CASHBACK_INSUFFICIENT_FUNDS', `O valor de cashback solicitado (${amount.toFixed(2)}) é maior do que o saldo disponível da carteira (${available.toFixed(2)}).`, 422);
    }
    const newReserved = wallet.reservedBalance.plus(amount);
    await updateWallet(tx, wallet, wallet.balance, newReserved);
    const balanceAfter = wallet.balance.minus(newReserved);
    await insertTransaction(tx, wallet.id, appointmentId, 'RESERVE', amount, balanceAfter, 'Reserva para agendamento');
    wallet.reservedBalance = newReserved;
}
async function debitReserved(tx, wallet, appointmentId, amount) {
    if (amount.equals(0))
        return;
    const newBalance = wallet.balance.minus(amount);
    const newReserved = wallet.reservedBalance.minus(amount);
    await updateWallet(tx, wallet, newBalance, newReserved);
    await insertTransaction(tx, wallet.id, appointmentId, 'DEBIT', amount, newBalance, 'Cashback utilizado no pagamento');
    wallet.balance = newBalance;
    wallet.reservedBalance = newReserved;
}
async function release(tx, wallet, appointmentId, amount) {
    if (amount.equals(0))
        return;
    const newReserved = wallet.reservedBalance.minus(amount);
    await updateWallet(tx, wallet, wallet.balance, newReserved);
    const balanceAfter = wallet.balance.minus(newReserved);
    await insertTransaction(tx, wallet.id, appointmentId, 'RELEASE', amount, balanceAfter, 'Reserva liberada');
    wallet.reservedBalance = newReserved;
}
async function refund(tx, wallet, appointmentId, amount) {
    if (amount.equals(0))
        return;
    const newBalance = wallet.balance.plus(amount);
    await updateWallet(tx, wallet, newBalance, wallet.reservedBalance);
    await insertTransaction(tx, wallet.id, appointmentId, 'CREDIT', amount, newBalance, 'Cashback devolvido por cancelamento');
    wallet.balance = newBalance;
}
async function creditEarned(tx, wallet, appointmentId, amountPaid, cashbackRate) {
    const earned = amountPaid.mul(cashbackRate).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
    if (earned.equals(0))
        return earned;
    const newBalance = wallet.balance.plus(earned);
    await updateWallet(tx, wallet, newBalance, wallet.reservedBalance);
    await insertTransaction(tx, wallet.id, appointmentId, 'CREDIT', earned, newBalance, 'Cashback por serviço concluído');
    wallet.balance = newBalance;
    return earned;
}
async function updateWallet(tx, wallet, newBalance, newReserved) {
    // updateMany com guarda de versão preserva o lock otimista sem passar Decimal por
    // $executeRaw — o engine do Prisma 6.x não serializa Decimal em raw dentro de
    // transação interativa ("Could not convert from JSON decimal value to PrismaValue").
    const result = await tx.cashbackWallet.updateMany({
        where: { id: wallet.id, version: wallet.version },
        data: { balance: newBalance, reservedBalance: newReserved, version: { increment: 1 } },
    });
    if (result.count === 0) {
        throw new BusinessError_1.BusinessError('WALLET_CONFLICT', 'Modificação concorrente na carteira. Tente novamente.', 409);
    }
    wallet.version = wallet.version + BigInt(1);
}
async function insertTransaction(tx, walletId, appointmentId, type, amount, balanceAfter, description) {
    await tx.cashbackTransaction.create({
        data: { walletId, appointmentId, type, amount, balanceAfter, description },
    });
}
