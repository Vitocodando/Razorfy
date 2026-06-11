package com.razorfy.payment;

import com.razorfy.appointment.Appointment;
import com.razorfy.appointment.AppointmentApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments/webhooks")
public class PaymentWebhookController {

    private final AppointmentApplicationService appointments;

    public PaymentWebhookController(AppointmentApplicationService appointments) {
        this.appointments = appointments;
    }

    @PostMapping("/mock")
    WebhookResponse mock(@Valid @RequestBody PaymentWebhookRequest request) {
        Appointment appointment = appointments.confirmPayment(request.appointmentId(), request.paymentReference());
        return new WebhookResponse(appointment.getId(), appointment.getStatus().name());
    }
}

record PaymentWebhookRequest(
        @NotNull UUID appointmentId,
        @NotBlank String paymentReference) {}

record WebhookResponse(UUID appointmentId, String status) {}
