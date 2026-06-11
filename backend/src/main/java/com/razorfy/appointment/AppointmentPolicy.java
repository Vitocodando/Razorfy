package com.razorfy.appointment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;

public final class AppointmentPolicy {

    private AppointmentPolicy() {}

    public static OffsetDateTime calculateEnd(OffsetDateTime start, List<Integer> serviceDurations) {
        int totalMinutes = serviceDurations.stream().mapToInt(Integer::intValue).sum();
        return start.plusMinutes(totalMinutes);
    }

    public static boolean canCancel(OffsetDateTime appointmentStart, OffsetDateTime now) {
        return !appointmentStart.minusHours(2).isBefore(now);
    }

    public static BigDecimal cashbackEarned(BigDecimal amountPaid, BigDecimal rate) {
        return amountPaid.multiply(rate).setScale(2, RoundingMode.HALF_UP);
    }
}
