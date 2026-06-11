package com.razorfy.schedule;

import com.razorfy.appointment.Appointment;
import com.razorfy.appointment.AppointmentRepository;
import com.razorfy.appointment.AppointmentStatus;
import com.razorfy.common.BusinessException;
import com.razorfy.user.User;
import com.razorfy.user.UserRepository;
import com.razorfy.user.UserRole;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AvailabilityService {

    private static final List<AppointmentStatus> BLOCKING_STATUSES =
            List.of(AppointmentStatus.PENDING_PAYMENT, AppointmentStatus.CONFIRMED);
    private static final int GRID_MINUTES = 15;

    private final UserRepository users;
    private final BarberSlotRepository slots;
    private final AppointmentRepository appointments;
    private final ZoneId businessZone;
    private final Clock clock;

    public AvailabilityService(
            UserRepository users,
            BarberSlotRepository slots,
            AppointmentRepository appointments,
            ZoneId businessZone,
            Clock clock) {
        this.users = users;
        this.slots = slots;
        this.appointments = appointments;
        this.businessZone = businessZone;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<OffsetDateTime> availableStarts(UUID barberId, LocalDate date, int durationMinutes) {
        if (durationMinutes <= 0 || durationMinutes > 12 * 60) {
            throw new BusinessException(
                    "INVALID_DURATION", "A duração deve estar entre 1 e 720 minutos.", HttpStatus.BAD_REQUEST);
        }
        requireBarber(barberId);
        BarberSlot slot = slots.findByBarberIdAndDayOfWeek(barberId, date.getDayOfWeek().getValue())
                .orElse(null);
        if (slot == null) return List.of();

        ZonedDateTime dayStart = date.atStartOfDay(businessZone);
        OffsetDateTime queryStart = dayStart.toOffsetDateTime();
        OffsetDateTime queryEnd = dayStart.plusDays(1).toOffsetDateTime();
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Appointment> booked = appointments.findOverlapping(
                barberId, queryStart, queryEnd, BLOCKING_STATUSES);

        ZonedDateTime cursor = date.atTime(slot.getStartTime()).atZone(businessZone);
        ZonedDateTime workEnd = date.atTime(slot.getEndTime()).atZone(businessZone);
        return Stream.iterate(
                        cursor,
                        start -> start.isBefore(workEnd),
                        start -> start.plusMinutes(GRID_MINUTES))
                .filter(start -> {
                    ZonedDateTime end = start.plusMinutes(durationMinutes);
                    if (!ScheduleRules.fits(slot, start, end)) return false;
                    OffsetDateTime candidateStart = start.toOffsetDateTime();
                    OffsetDateTime candidateEnd = end.toOffsetDateTime();
                    if (!candidateStart.isAfter(now)) return false;
                    return booked.stream()
                            .filter(appointment -> appointment.getStatus() != AppointmentStatus.PENDING_PAYMENT
                                    || appointment.getHoldExpiresAt() == null
                                    || appointment.getHoldExpiresAt().isAfter(now))
                            .noneMatch(appointment -> overlaps(
                                    candidateStart,
                                    candidateEnd,
                                    appointment.getStartTimestamp(),
                                    appointment.getEndTimestamp()));
                })
                .map(ZonedDateTime::toOffsetDateTime)
                .toList();
    }

    @Transactional(readOnly = true)
    public void assertWorkingTime(UUID barberId, OffsetDateTime start, OffsetDateTime end) {
        ZonedDateTime localStart = start.atZoneSameInstant(businessZone);
        ZonedDateTime localEnd = end.atZoneSameInstant(businessZone);
        BarberSlot slot = slots
                .findByBarberIdAndDayOfWeek(barberId, localStart.getDayOfWeek().getValue())
                .orElseThrow(this::notAvailable);
        if (!ScheduleRules.fits(slot, localStart, localEnd)) throw notAvailable();
    }

    public boolean overlaps(
            OffsetDateTime firstStart,
            OffsetDateTime firstEnd,
            OffsetDateTime secondStart,
            OffsetDateTime secondEnd) {
        return firstStart.isBefore(secondEnd) && firstEnd.isAfter(secondStart);
    }

    private void requireBarber(UUID barberId) {
        User barber = users.findById(barberId)
                .orElseThrow(() -> new BusinessException(
                        "BARBER_NOT_FOUND", "Profissional não encontrado.", HttpStatus.NOT_FOUND));
        if (barber.getRole() != UserRole.BARBER) {
            throw new BusinessException(
                    "BARBER_NOT_FOUND", "Profissional não encontrado.", HttpStatus.NOT_FOUND);
        }
    }

    private BusinessException notAvailable() {
        return new BusinessException(
                "BARBER_NOT_AVAILABLE",
                "O profissional selecionado não possui expediente no horário escolhido.",
                HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
