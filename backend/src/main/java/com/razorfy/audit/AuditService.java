package com.razorfy.audit;

import com.razorfy.appointment.Appointment;
import com.razorfy.appointment.AppointmentStatus;
import com.razorfy.user.User;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditService.class);
    private final AppointmentStatusHistoryRepository histories;

    public AuditService(AppointmentStatusHistoryRepository histories) {
        this.histories = histories;
    }

    public void statusChanged(
            Appointment appointment,
            AppointmentStatus from,
            AppointmentStatus to,
            User actor,
            Map<String, Object> payload) {
        histories.save(new AppointmentStatusHistory(appointment, from, to, actor, payload));
        LOGGER.atInfo()
                .addKeyValue("user_id", actor == null ? "system" : actor.getId())
                .addKeyValue("appointment_id", appointment.getId())
                .addKeyValue("payload", payload)
                .log("appointment_status_changed from={} to={}", from, to);
    }

    public void walletChanged(User actor, Appointment appointment, Map<String, Object> payload) {
        LOGGER.atInfo()
                .addKeyValue("user_id", actor == null ? "system" : actor.getId())
                .addKeyValue("appointment_id", appointment == null ? null : appointment.getId())
                .addKeyValue("payload", payload)
                .log("cashback_wallet_changed");
    }
}
