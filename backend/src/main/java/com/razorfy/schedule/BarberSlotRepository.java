package com.razorfy.schedule;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BarberSlotRepository extends JpaRepository<BarberSlot, UUID> {
    Optional<BarberSlot> findByBarberIdAndDayOfWeek(UUID barberId, int dayOfWeek);
}
