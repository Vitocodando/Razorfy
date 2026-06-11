package com.razorfy.cashback;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface CashbackWalletRepository extends JpaRepository<CashbackWallet, UUID> {

    Optional<CashbackWallet> findByClientId(UUID clientId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CashbackWallet> findWithLockByClientId(UUID clientId);
}
