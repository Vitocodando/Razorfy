package com.razorfy.cashback;

import com.razorfy.common.BusinessException;
import com.razorfy.security.CurrentUser;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/wallet")
public class WalletController {

    private final CashbackWalletRepository wallets;
    private final CashbackTransactionRepository transactions;
    private final CurrentUser currentUser;

    public WalletController(
            CashbackWalletRepository wallets,
            CashbackTransactionRepository transactions,
            CurrentUser currentUser) {
        this.wallets = wallets;
        this.transactions = transactions;
        this.currentUser = currentUser;
    }

    @GetMapping
    WalletResponse getWallet(JwtAuthenticationToken authentication) {
        UUID clientId = currentUser.id(authentication);
        CashbackWallet wallet = wallets.findByClientId(clientId)
                .orElseThrow(() -> new BusinessException(
                        "WALLET_NOT_FOUND", "Carteira não encontrada.", HttpStatus.NOT_FOUND));
        List<TransactionView> entries = transactions.findAllByWalletIdOrderByCreatedAtDesc(wallet.getId()).stream()
                .map(entry -> new TransactionView(
                        entry.getType().name(),
                        entry.getAmount(),
                        entry.getBalanceAfter(),
                        entry.getDescription(),
                        entry.getCreatedAt()))
                .toList();
        return new WalletResponse(wallet.getBalance(), wallet.getReservedBalance(), wallet.availableBalance(), entries);
    }
}

record WalletResponse(
        BigDecimal balance,
        BigDecimal reservedBalance,
        BigDecimal availableBalance,
        List<TransactionView> transactions) {}

record TransactionView(
        String type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        String description,
        OffsetDateTime createdAt) {}
