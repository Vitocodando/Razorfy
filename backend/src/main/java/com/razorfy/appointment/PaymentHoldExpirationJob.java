package com.razorfy.appointment;

import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PaymentHoldExpirationJob {

    private final AppointmentRepository appointments;
    private final AppointmentApplicationService appointmentService;
    private final Clock clock;

    public PaymentHoldExpirationJob(
            AppointmentRepository appointments,
            AppointmentApplicationService appointmentService,
            Clock clock) {
        this.appointments = appointments;
        this.appointmentService = appointmentService;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 60000)
    public void expirePendingPayments() {
        appointments.findAllByStatusAndHoldExpiresAtBefore(
                        AppointmentStatus.PENDING_PAYMENT, OffsetDateTime.now(clock))
                .stream()
                .map(Appointment::getId)
                .forEach(appointmentService::expirePaymentHold);
    }
}
