package com.razorfy.cashback;

import com.razorfy.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "cashback_wallets")
public class CashbackWallet {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private User client;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal balance;

    @Column(name = "reserved_balance", nullable = false, precision = 10, scale = 2)
    private BigDecimal reservedBalance;

    @Version
    private long version;

    protected CashbackWallet() {}

    public CashbackWallet(User client) {
        this.id = UUID.randomUUID();
        this.client = client;
        this.balance = BigDecimal.ZERO.setScale(2);
        this.reservedBalance = BigDecimal.ZERO.setScale(2);
    }

    public BigDecimal availableBalance() {
        return balance.subtract(reservedBalance);
    }

    public void reserve(BigDecimal amount) {
        reservedBalance = reservedBalance.add(amount);
    }

    public void release(BigDecimal amount) {
        reservedBalance = reservedBalance.subtract(amount);
    }

    public void debitReserved(BigDecimal amount) {
        reservedBalance = reservedBalance.subtract(amount);
        balance = balance.subtract(amount);
    }

    public void credit(BigDecimal amount) {
        balance = balance.add(amount);
    }

    public UUID getId() { return id; }
    public BigDecimal getBalance() { return balance; }
    public BigDecimal getReservedBalance() { return reservedBalance; }
}
