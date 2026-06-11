package com.razorfy.notification;

import com.razorfy.appointment.Appointment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notification_outbox")
public class NotificationOutbox {

    public enum Channel { PUSH, WHATSAPP }
    public enum Status { PENDING, SENT, FAILED }

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channel;

    @Column(nullable = false, length = 160)
    private String destination;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private OffsetDateTime nextAttemptAt;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected NotificationOutbox() {}

    public NotificationOutbox(
            Appointment appointment,
            Channel channel,
            String destination,
            String eventType,
            Map<String, Object> payload,
            OffsetDateTime nextAttemptAt) {
        this.id = UUID.randomUUID();
        this.appointment = appointment;
        this.channel = channel;
        this.destination = destination;
        this.eventType = eventType;
        this.payload = payload;
        this.status = Status.PENDING;
        this.nextAttemptAt = nextAttemptAt;
    }

    public void markSent(OffsetDateTime sentAt) {
        status = Status.SENT;
        this.sentAt = sentAt;
        attempts++;
        lastError = null;
    }

    public void markFailed(String error, OffsetDateTime nextAttemptAt, int maxAttempts) {
        attempts++;
        status = attempts >= maxAttempts ? Status.FAILED : Status.PENDING;
        lastError = error == null ? "Falha desconhecida" : error.substring(0, Math.min(error.length(), 500));
        this.nextAttemptAt = nextAttemptAt;
    }

    public Channel getChannel() { return channel; }
    public String getDestination() { return destination; }
    public String getEventType() { return eventType; }
    public Map<String, Object> getPayload() { return payload; }
}
