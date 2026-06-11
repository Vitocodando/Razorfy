package com.razorfy.notification;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<NotificationOutbox> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAt(
            NotificationOutbox.Status status, OffsetDateTime now);
}
