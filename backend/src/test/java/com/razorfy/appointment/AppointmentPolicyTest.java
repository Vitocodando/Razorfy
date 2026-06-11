package com.razorfy.appointment;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class AppointmentPolicyTest {

    @Test
    void accumulatesMultipleServiceDurations() {
        OffsetDateTime start = OffsetDateTime.parse("2026-06-15T14:00:00Z");

        OffsetDateTime end = AppointmentPolicy.calculateEnd(start, List.of(30, 30, 15));

        assertThat(end).isEqualTo(OffsetDateTime.parse("2026-06-15T15:15:00Z"));
    }

    @Test
    void acceptsCancellationExactlyTwoHoursBefore() {
        OffsetDateTime appointment = OffsetDateTime.parse("2026-06-15T17:00:00Z");

        assertThat(AppointmentPolicy.canCancel(
                appointment, OffsetDateTime.parse("2026-06-15T15:00:00Z"))).isTrue();
        assertThat(AppointmentPolicy.canCancel(
                appointment, OffsetDateTime.parse("2026-06-15T15:00:01Z"))).isFalse();
    }

    @Test
    void earnsCashbackOnlyOnAmountActuallyPaid() {
        BigDecimal earned = AppointmentPolicy.cashbackEarned(
                new BigDecimal("80.00"), new BigDecimal("0.05"));

        assertThat(earned).isEqualByComparingTo("4.00");
    }
}
