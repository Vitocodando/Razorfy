package com.razorfy.schedule;

import java.time.LocalDate;
import java.time.ZonedDateTime;

public final class ScheduleRules {

    private ScheduleRules() {}

    public static boolean fits(BarberSlot slot, ZonedDateTime start, ZonedDateTime end) {
        LocalDate date = start.toLocalDate();
        if (!date.equals(end.toLocalDate())) return false;
        if (start.toLocalTime().isBefore(slot.getStartTime())) return false;
        if (end.toLocalTime().isAfter(slot.getEndTime())) return false;
        if (slot.getLunchStart() == null) return true;
        return !start.toLocalTime().isBefore(slot.getLunchEnd())
                || !end.toLocalTime().isAfter(slot.getLunchStart());
    }
}
