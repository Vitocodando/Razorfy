package com.razorfy.appointment;

import com.razorfy.catalog.ServiceItem;
import com.razorfy.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "appointments")
public class Appointment {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private User client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barber_id")
    private User barber;

    @Column(name = "start_timestamp", nullable = false)
    private OffsetDateTime startTimestamp;

    @Column(name = "end_timestamp", nullable = false)
    private OffsetDateTime endTimestamp;

    @Column(name = "total_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "cashback_used", nullable = false, precision = 10, scale = 2)
    private BigDecimal cashbackUsed;

    @Column(name = "amount_paid", nullable = false, precision = 10, scale = 2)
    private BigDecimal amountPaid;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AppointmentStatus status;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    @Column(name = "hold_expires_at")
    private OffsetDateTime holdExpiresAt;

    @Column(name = "cashback_credited", nullable = false)
    private boolean cashbackCredited;

    @OneToMany(mappedBy = "appointment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AppointmentService> services = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    private long version;

    protected Appointment() {}

    public Appointment(
            User client,
            User barber,
            OffsetDateTime startTimestamp,
            OffsetDateTime endTimestamp,
            BigDecimal totalPrice,
            BigDecimal cashbackUsed,
            PaymentMethod paymentMethod,
            AppointmentStatus status,
            OffsetDateTime holdExpiresAt) {
        this.id = UUID.randomUUID();
        this.client = client;
        this.barber = barber;
        this.startTimestamp = startTimestamp;
        this.endTimestamp = endTimestamp;
        this.totalPrice = totalPrice;
        this.cashbackUsed = cashbackUsed;
        this.amountPaid = totalPrice.subtract(cashbackUsed);
        this.paymentMethod = paymentMethod;
        this.status = status;
        this.holdExpiresAt = holdExpiresAt;
    }

    public void addService(ServiceItem service) {
        services.add(new AppointmentService(this, service));
    }

    public void changeStatus(AppointmentStatus status) { this.status = status; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
    public void markCashbackCredited() { this.cashbackCredited = true; }

    public UUID getId() { return id; }
    public User getClient() { return client; }
    public User getBarber() { return barber; }
    public OffsetDateTime getStartTimestamp() { return startTimestamp; }
    public OffsetDateTime getEndTimestamp() { return endTimestamp; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public BigDecimal getCashbackUsed() { return cashbackUsed; }
    public BigDecimal getAmountPaid() { return amountPaid; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public AppointmentStatus getStatus() { return status; }
    public String getPaymentReference() { return paymentReference; }
    public OffsetDateTime getHoldExpiresAt() { return holdExpiresAt; }
    public boolean isCashbackCredited() { return cashbackCredited; }
    public List<AppointmentService> getServices() { return List.copyOf(services); }
}
