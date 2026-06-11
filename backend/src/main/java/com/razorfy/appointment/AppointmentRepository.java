package com.razorfy.appointment;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a join fetch a.client join fetch a.barber where a.id = :id")
    Optional<Appointment> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
        select a from Appointment a
        where a.barber.id = :barberId
          and a.status in :statuses
          and a.startTimestamp < :end
          and a.endTimestamp > :start
        order by a.startTimestamp
        """)
    List<Appointment> findOverlapping(
            @Param("barberId") UUID barberId,
            @Param("start") OffsetDateTime start,
            @Param("end") OffsetDateTime end,
            @Param("statuses") Collection<AppointmentStatus> statuses);

    @EntityGraph(attributePaths = {"services", "barber"})
    List<Appointment> findAllByClientIdOrderByStartTimestampDesc(UUID clientId);

    List<Appointment> findAllByStatusAndHoldExpiresAtBefore(
            AppointmentStatus status, OffsetDateTime expiration);
}
