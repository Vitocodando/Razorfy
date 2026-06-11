package com.razorfy.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;

class ScheduleRulesTest {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private final BarberSlot slot = new BarberSlot(
            LocalTime.of(9, 0),
            LocalTime.of(19, 0),
            LocalTime.of(12, 0),
            LocalTime.of(13, 0));

    @Test
    void rejectsAppointmentThatInterceptsLunch() {
        ZonedDateTime start = ZonedDateTime.of(2026, 6, 15, 12, 15, 0, 0, ZONE);

        assertThat(ScheduleRules.fits(slot, start, start.plusMinutes(30))).isFalse();
    }

    @Test
    void acceptsAppointmentEndingExactlyAtLunch() {
        ZonedDateTime start = ZonedDateTime.of(2026, 6, 15, 11, 30, 0, 0, ZONE);

        assertThat(ScheduleRules.fits(slot, start, start.plusMinutes(30))).isTrue();
    }
}
