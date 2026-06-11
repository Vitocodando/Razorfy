package com.razorfy.appointment;

import com.razorfy.payment.PaymentGateway;
import com.razorfy.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentController {

    private final AppointmentApplicationService appointmentService;
    private final CurrentUser currentUser;

    public AppointmentController(
            AppointmentApplicationService appointmentService,
            CurrentUser currentUser) {
        this.appointmentService = appointmentService;
        this.currentUser = currentUser;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    AppointmentResponse create(
            @Valid @RequestBody CreateAppointmentRequest request,
            JwtAuthenticationToken authentication) {
        AppointmentCreationResult result = appointmentService.create(
                currentUser.id(authentication),
                new CreateAppointmentCommand(
                        request.barberId(),
                        request.serviceIds(),
                        request.startTimestamp(),
                        request.useCashback(),
                        request.cashbackAmountToApply(),
                        request.paymentMethod()));
        return AppointmentResponse.from(result.appointment(), result.paymentIntent());
    }

    @GetMapping("/mine")
    List<AppointmentResponse> mine(JwtAuthenticationToken authentication) {
        return appointmentService.listClientAppointments(currentUser.id(authentication)).stream()
                .map(appointment -> AppointmentResponse.from(appointment, null))
                .toList();
    }

    @PostMapping("/{id}/cancel")
    AppointmentResponse cancel(@PathVariable UUID id, JwtAuthenticationToken authentication) {
        return AppointmentResponse.from(
                appointmentService.cancel(id, currentUser.id(authentication)), null);
    }

    @PostMapping("/{id}/conclude")
    @PreAuthorize("hasAnyRole('BARBER','ADMIN','DEV')")
    AppointmentResponse conclude(@PathVariable UUID id, JwtAuthenticationToken authentication) {
        return AppointmentResponse.from(
                appointmentService.conclude(id, currentUser.id(authentication)), null);
    }
}

record CreateAppointmentRequest(
        @NotNull UUID barberId,
        @NotEmpty List<@NotNull UUID> serviceIds,
        @NotNull OffsetDateTime startTimestamp,
        boolean useCashback,
        @DecimalMin(value = "0.00") BigDecimal cashbackAmountToApply,
        @NotNull PaymentMethod paymentMethod) {}

record AppointmentResponse(
        UUID appointmentId,
        String status,
        BigDecimal totalPrice,
        BigDecimal cashbackUsed,
        BigDecimal amountToPay,
        OffsetDateTime startTimestamp,
        OffsetDateTime endTimestamp,
        String barberName,
        List<AppointmentServiceView> services,
        PaymentPayload paymentPayload) {

    static AppointmentResponse from(Appointment appointment, PaymentGateway.PaymentIntent intent) {
        PaymentPayload payload = intent == null
                ? null
                : new PaymentPayload(intent.qrCodeBase64(), intent.copyPasteCode());
        return new AppointmentResponse(
                appointment.getId(),
                appointment.getStatus().name(),
                appointment.getTotalPrice(),
                appointment.getCashbackUsed(),
                appointment.getAmountPaid(),
                appointment.getStartTimestamp(),
                appointment.getEndTimestamp(),
                appointment.getBarber().getName(),
                appointment.getServices().stream()
                        .map(service -> new AppointmentServiceView(
                                service.getServiceName(), service.getDurationMinutes(), service.getPrice()))
                        .toList(),
                payload);
    }
}

record AppointmentServiceView(String name, int durationMinutes, BigDecimal price) {}
record PaymentPayload(String qrCodeBase64, String copyPasteCode) {}
