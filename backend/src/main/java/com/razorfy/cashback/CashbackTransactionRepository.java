package com.razorfy.cashback;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashbackTransactionRepository extends JpaRepository<CashbackTransaction, UUID> {
    List<CashbackTransaction> findAllByWalletIdOrderByCreatedAtDesc(UUID walletId);
}
