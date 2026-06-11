package com.razorfy.cashback;

import com.razorfy.appointment.Appointment;
import com.razorfy.appointment.AppointmentPolicy;
import com.razorfy.audit.AuditService;
import com.razorfy.common.BusinessException;
import com.razorfy.user.User;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CashbackService {

    private final CashbackWalletRepository wallets;
    private final CashbackTransactionRepository transactions;
    private final AuditService auditService;

    public CashbackService(
            CashbackWalletRepository wallets,
            CashbackTransactionRepository transactions,
            AuditService auditService) {
        this.wallets = wallets;
        this.transactions = transactions;
        this.auditService = auditService;
    }

    public CashbackWallet lockWallet(User client) {
        return wallets.findWithLockByClientId(client.getId())
                .orElseGet(() -> wallets.save(new CashbackWallet(client)));
    }

    public void reserve(CashbackWallet wallet, Appointment appointment, BigDecimal amount) {
        if (amount.signum() == 0) return;
        if (amount.compareTo(wallet.availableBalance()) > 0) {
            throw new BusinessException(
                    "CASHBACK_INSUFFICIENT_FUNDS",
                    "O valor de cashback solicitado (" + money(amount)
                            + ") é maior do que o saldo disponível da carteira ("
                            + money(wallet.availableBalance()) + ").",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        wallet.reserve(amount);
        transactions.save(new CashbackTransaction(
                wallet, appointment, CashbackTransaction.Type.RESERVE, amount, "Reserva para agendamento"));
        audit(wallet, appointment, "RESERVE", amount);
    }

    public void debitReserved(CashbackWallet wallet, Appointment appointment, BigDecimal amount) {
        if (amount.signum() == 0) return;
        wallet.debitReserved(amount);
        transactions.save(new CashbackTransaction(
                wallet, appointment, CashbackTransaction.Type.DEBIT, amount, "Cashback utilizado no pagamento"));
        audit(wallet, appointment, "DEBIT", amount);
    }

    public void release(CashbackWallet wallet, Appointment appointment, BigDecimal amount) {
        if (amount.signum() == 0) return;
        wallet.release(amount);
        transactions.save(new CashbackTransaction(
                wallet, appointment, CashbackTransaction.Type.RELEASE, amount, "Reserva liberada"));
        audit(wallet, appointment, "RELEASE", amount);
    }

    public void refund(CashbackWallet wallet, Appointment appointment, BigDecimal amount) {
        if (amount.signum() == 0) return;
        wallet.credit(amount);
        transactions.save(new CashbackTransaction(
                wallet, appointment, CashbackTransaction.Type.CREDIT, amount, "Cashback devolvido por cancelamento"));
        audit(wallet, appointment, "REFUND", amount);
    }

    public BigDecimal creditEarned(
            CashbackWallet wallet, Appointment appointment, BigDecimal cashbackRate) {
        BigDecimal amount = AppointmentPolicy.cashbackEarned(appointment.getAmountPaid(), cashbackRate);
        if (amount.signum() == 0) return amount;
        wallet.credit(amount);
        transactions.save(new CashbackTransaction(
                wallet, appointment, CashbackTransaction.Type.CREDIT, amount, "Cashback por serviço concluído"));
        audit(wallet, appointment, "CREDIT", amount);
        return amount;
    }

    private void audit(
            CashbackWallet wallet, Appointment appointment, String operation, BigDecimal amount) {
        auditService.walletChanged(appointment.getClient(), appointment, Map.of(
                "operation", operation,
                "amount", amount,
                "balance", wallet.getBalance(),
                "reservedBalance", wallet.getReservedBalance()));
    }

    private String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
