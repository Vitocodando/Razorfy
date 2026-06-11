package com.razorfy.notification;

import com.razorfy.appointment.Appointment;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private final NotificationOutboxRepository outbox;
    private final Clock clock;

    public NotificationService(NotificationOutboxRepository outbox, Clock clock) {
        this.outbox = outbox;
        this.clock = clock;
    }

    public void appointmentEvent(Appointment appointment, String eventType) {
        Map<String, Object> payload = Map.of(
                "appointmentId", appointment.getId().toString(),
                "clientName", appointment.getClient().getName(),
                "barberName", appointment.getBarber().getName(),
                "startTimestamp", appointment.getStartTimestamp().toString(),
                "status", appointment.getStatus().name());
        OffsetDateTime now = OffsetDateTime.now(clock);
        outbox.save(new NotificationOutbox(
                appointment,
                NotificationOutbox.Channel.PUSH,
                appointment.getClient().getId().toString(),
                eventType,
                payload,
                now));
        outbox.save(new NotificationOutbox(
                appointment,
                NotificationOutbox.Channel.WHATSAPP,
                appointment.getClient().getPhone(),
                eventType,
                payload,
                now));
    }

    public void scheduleReminder(Appointment appointment) {
        OffsetDateTime remindAt = appointment.getStartTimestamp().minusHours(2);
        if (remindAt.isBefore(OffsetDateTime.now(clock))) return;
        Map<String, Object> payload = Map.of(
                "appointmentId", appointment.getId().toString(),
                "startTimestamp", appointment.getStartTimestamp().toString(),
                "barberName", appointment.getBarber().getName());
        outbox.save(new NotificationOutbox(
                appointment,
                NotificationOutbox.Channel.PUSH,
                appointment.getClient().getId().toString(),
                "APPOINTMENT_REMINDER",
                payload,
                remindAt));
        outbox.save(new NotificationOutbox(
                appointment,
                NotificationOutbox.Channel.WHATSAPP,
                appointment.getClient().getPhone(),
                "APPOINTMENT_REMINDER",
                payload,
                remindAt));
    }
}
