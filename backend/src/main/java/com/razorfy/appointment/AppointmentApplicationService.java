package com.razorfy.appointment;

import com.razorfy.audit.AuditService;
import com.razorfy.cashback.CashbackService;
import com.razorfy.cashback.CashbackWallet;
import com.razorfy.catalog.ServiceItem;
import com.razorfy.catalog.ServiceItemRepository;
import com.razorfy.common.BusinessException;
import com.razorfy.config.RazorfyProperties;
import com.razorfy.notification.NotificationService;
import com.razorfy.payment.PaymentGateway;
import com.razorfy.schedule.AvailabilityService;
import com.razorfy.user.User;
import com.razorfy.user.UserRepository;
import com.razorfy.user.UserRole;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentApplicationService {

    private static final List<AppointmentStatus> BLOCKING_STATUSES =
            List.of(AppointmentStatus.PENDING_PAYMENT, AppointmentStatus.CONFIRMED);

    private final AppointmentRepository appointments;
    private final UserRepository users;
    private final ServiceItemRepository catalog;
    private final AvailabilityService availability;
    private final CashbackService cashback;
    private final PaymentGateway payments;
    private final NotificationService notifications;
    private final AuditService audit;
    private final RazorfyProperties properties;
    private final Clock clock;

    public AppointmentApplicationService(
            AppointmentRepository appointments,
            UserRepository users,
            ServiceItemRepository catalog,
            AvailabilityService availability,
            CashbackService cashback,
            PaymentGateway payments,
            NotificationService notifications,
            AuditService audit,
            RazorfyProperties properties,
            Clock clock) {
        this.appointments = appointments;
        this.users = users;
        this.catalog = catalog;
        this.availability = availability;
        this.cashback = cashback;
        this.payments = payments;
        this.notifications = notifications;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public AppointmentCreationResult create(UUID clientId, CreateAppointmentCommand command) {
        validateServiceIds(command.serviceIds());
        User client = requireUser(clientId);
        if (client.getRole() != UserRole.CLIENT) {
            throw new BusinessException("CLIENT_REQUIRED", "Apenas clientes podem criar agendamentos.", HttpStatus.FORBIDDEN);
        }
        User barber = users.findByIdForUpdate(command.barberId())
                .orElseThrow(() -> new BusinessException(
                        "BARBER_NOT_FOUND", "Profissional não encontrado.", HttpStatus.NOT_FOUND));
        if (barber.getRole() != UserRole.BARBER) {
            throw new BusinessException("BARBER_NOT_FOUND", "Profissional não encontrado.", HttpStatus.NOT_FOUND);
        }

        List<ServiceItem> selectedServices = catalog.findAllById(command.serviceIds()).stream()
                .filter(ServiceItem::isActive)
                .toList();
        if (selectedServices.size() != command.serviceIds().size()) {
            throw new BusinessException(
                    "SERVICE_NOT_FOUND", "Um ou mais serviços não estão disponíveis.", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        BigDecimal total = selectedServices.stream()
                .map(ServiceItem::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal requestedCashback = normalizeCashback(command, total);
        OffsetDateTime start = command.startTimestamp();
        OffsetDateTime end = AppointmentPolicy.calculateEnd(
                start, selectedServices.stream().map(ServiceItem::getDurationMinutes).toList());
        if (!start.isAfter(OffsetDateTime.now(clock))) {
            throw new BusinessException(
                    "APPOINTMENT_MUST_BE_FUTURE", "O agendamento deve estar no futuro.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        availability.assertWorkingTime(barber.getId(), start, end);
        if (!appointments.findOverlapping(barber.getId(), start, end, BLOCKING_STATUSES).isEmpty()) {
            throw slotConflict();
        }

        boolean online = command.paymentMethod() != PaymentMethod.PRESENTIAL;
        AppointmentStatus initialStatus = online
                ? AppointmentStatus.PENDING_PAYMENT
                : AppointmentStatus.CONFIRMED;
        OffsetDateTime holdExpiresAt = online
                ? OffsetDateTime.now(clock).plusMinutes(properties.paymentHoldMinutes())
                : null;
        Appointment appointment = new Appointment(
                client,
                barber,
                start,
                end,
                total,
                requestedCashback,
                command.paymentMethod(),
                initialStatus,
                holdExpiresAt);
        selectedServices.forEach(appointment::addService);
        appointments.save(appointment);

        CashbackWallet wallet = cashback.lockWallet(client);
        cashback.reserve(wallet, appointment, requestedCashback);

        PaymentGateway.PaymentIntent intent = null;
        if (online) {
            intent = payments.createIntent(appointment);
            appointment.setPaymentReference(intent.reference());
        } else {
            cashback.debitReserved(wallet, appointment, requestedCashback);
            notifications.appointmentEvent(appointment, "APPOINTMENT_CONFIRMED");
            notifications.scheduleReminder(appointment);
        }
        audit.statusChanged(appointment, null, initialStatus, client, Map.of("source", "CREATE"));
        return new AppointmentCreationResult(appointment, intent);
    }

    @Transactional
    public Appointment confirmPayment(UUID appointmentId, String paymentReference) {
        Appointment appointment = lockAppointment(appointmentId);
        if (appointment.getStatus() == AppointmentStatus.CONFIRMED) return appointment;
        if (appointment.getStatus() != AppointmentStatus.PENDING_PAYMENT) {
            throw new BusinessException(
                    "INVALID_PAYMENT_STATE",
                    "O agendamento não está aguardando pagamento.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (appointment.getHoldExpiresAt() != null
                && !appointment.getHoldExpiresAt().isAfter(OffsetDateTime.now(clock))) {
            expireLocked(appointment);
            throw new BusinessException(
                    "PAYMENT_HOLD_EXPIRED",
                    "A reserva temporária expirou. Escolha um novo horário.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        users.findByIdForUpdate(appointment.getBarber().getId()).orElseThrow();
        boolean conflict = appointments.findOverlapping(
                        appointment.getBarber().getId(),
                        appointment.getStartTimestamp(),
                        appointment.getEndTimestamp(),
                        List.of(AppointmentStatus.CONFIRMED))
                .stream()
                .anyMatch(existing -> !existing.getId().equals(appointment.getId()));
        if (conflict) {
            cancelOverbooking(appointment);
            return appointment;
        }

        CashbackWallet wallet = cashback.lockWallet(appointment.getClient());
        cashback.debitReserved(wallet, appointment, appointment.getCashbackUsed());
        AppointmentStatus previous = appointment.getStatus();
        appointment.changeStatus(AppointmentStatus.CONFIRMED);
        if (paymentReference != null && !paymentReference.isBlank()) {
            appointment.setPaymentReference(paymentReference);
        }
        audit.statusChanged(
                appointment, previous, appointment.getStatus(), null, Map.of("source", "PAYMENT_WEBHOOK"));
        notifications.appointmentEvent(appointment, "APPOINTMENT_CONFIRMED");
        notifications.scheduleReminder(appointment);
        return appointment;
    }

    @Transactional
    public Appointment cancel(UUID appointmentId, UUID actorId) {
        Appointment appointment = lockAppointment(appointmentId);
        User actor = requireUser(actorId);
        if (!appointment.getClient().getId().equals(actorId)
                && actor.getRole() != UserRole.ADMIN
                && actor.getRole() != UserRole.DEV) {
            throw new BusinessException("APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.", HttpStatus.NOT_FOUND);
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED
                && appointment.getStatus() != AppointmentStatus.PENDING_PAYMENT) {
            throw new BusinessException(
                    "INVALID_APPOINTMENT_STATE", "Este agendamento não pode ser cancelado.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (!AppointmentPolicy.canCancel(appointment.getStartTimestamp(), OffsetDateTime.now(clock))) {
            throw new BusinessException(
                    "INVALID_CANCEL_WINDOW",
                    "Cancelamentos automáticos só são permitidos com pelo menos 2 horas de antecedência.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        CashbackWallet wallet = cashback.lockWallet(appointment.getClient());
        AppointmentStatus previous = appointment.getStatus();
        if (previous == AppointmentStatus.PENDING_PAYMENT) {
            cashback.release(wallet, appointment, appointment.getCashbackUsed());
        } else {
            cashback.refund(wallet, appointment, appointment.getCashbackUsed());
            if (appointment.getPaymentMethod() != PaymentMethod.PRESENTIAL) {
                payments.refund(appointment);
            }
        }
        appointment.changeStatus(AppointmentStatus.CANCELLED);
        audit.statusChanged(appointment, previous, appointment.getStatus(), actor, Map.of("source", "CLIENT_CANCEL"));
        notifications.appointmentEvent(appointment, "APPOINTMENT_CANCELLED");
        return initializeForResponse(appointment);
    }

    @Transactional
    public Appointment conclude(UUID appointmentId, UUID actorId) {
        Appointment appointment = lockAppointment(appointmentId);
        User actor = requireUser(actorId);
        if (actor.getRole() == UserRole.BARBER && !appointment.getBarber().getId().equals(actorId)) {
            throw new BusinessException(
                    "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.", HttpStatus.NOT_FOUND);
        }
        if (actor.getRole() == UserRole.CLIENT) {
            throw new BusinessException("STAFF_REQUIRED", "Operação restrita à equipe.", HttpStatus.FORBIDDEN);
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BusinessException(
                    "INVALID_APPOINTMENT_STATE", "Apenas agendamentos confirmados podem ser concluídos.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        CashbackWallet wallet = cashback.lockWallet(appointment.getClient());
        BigDecimal earned = cashback.creditEarned(wallet, appointment, properties.cashbackRate());
        AppointmentStatus previous = appointment.getStatus();
        appointment.changeStatus(AppointmentStatus.CONCLUDED);
        appointment.markCashbackCredited();
        audit.statusChanged(
                appointment, previous, appointment.getStatus(), actor, Map.of("cashbackEarned", earned));
        notifications.appointmentEvent(appointment, "APPOINTMENT_CONCLUDED");
        return initializeForResponse(appointment);
    }

    @Transactional
    public void expirePaymentHold(UUID appointmentId) {
        Appointment appointment = lockAppointment(appointmentId);
        if (appointment.getStatus() == AppointmentStatus.PENDING_PAYMENT
                && appointment.getHoldExpiresAt() != null
                && !appointment.getHoldExpiresAt().isAfter(OffsetDateTime.now(clock))) {
            expireLocked(appointment);
        }
    }

    @Transactional(readOnly = true)
    public List<Appointment> listClientAppointments(UUID clientId) {
        return appointments.findAllByClientIdOrderByStartTimestampDesc(clientId);
    }

    private void expireLocked(Appointment appointment) {
        CashbackWallet wallet = cashback.lockWallet(appointment.getClient());
        cashback.release(wallet, appointment, appointment.getCashbackUsed());
        AppointmentStatus previous = appointment.getStatus();
        appointment.changeStatus(AppointmentStatus.EXPIRED_PAYMENT);
        audit.statusChanged(appointment, previous, appointment.getStatus(), null, Map.of("source", "HOLD_EXPIRATION"));
    }

    private void cancelOverbooking(Appointment appointment) {
        CashbackWallet wallet = cashback.lockWallet(appointment.getClient());
        cashback.release(wallet, appointment, appointment.getCashbackUsed());
        AppointmentStatus previous = appointment.getStatus();
        appointment.changeStatus(AppointmentStatus.CANCELLED_OVERBOOKING);
        payments.refund(appointment);
        audit.statusChanged(appointment, previous, appointment.getStatus(), null, Map.of("source", "OVERBOOKING"));
        notifications.appointmentEvent(appointment, "APPOINTMENT_OVERBOOKING");
    }

    private Appointment lockAppointment(UUID id) {
        return appointments.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(
                        "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.", HttpStatus.NOT_FOUND));
    }

    private User requireUser(UUID id) {
        return users.findById(id)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "Usuário não encontrado.", HttpStatus.NOT_FOUND));
    }

    private BigDecimal normalizeCashback(CreateAppointmentCommand command, BigDecimal total) {
        BigDecimal amount = command.cashbackAmountToApply() == null
                ? BigDecimal.ZERO
                : command.cashbackAmountToApply().setScale(2, RoundingMode.HALF_UP);
        if (!command.useCashback()) {
            if (amount.signum() > 0) {
                throw new BusinessException(
                        "INVALID_CASHBACK_AMOUNT",
                        "Ative o uso de cashback para informar um valor.",
                        HttpStatus.UNPROCESSABLE_ENTITY);
            }
            return BigDecimal.ZERO.setScale(2);
        }
        if (amount.signum() <= 0) {
            throw new BusinessException(
                    "INVALID_CASHBACK_AMOUNT",
                    "O valor de cashback deve ser maior que zero.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (amount.compareTo(total) > 0) {
            throw new BusinessException(
                    "CASHBACK_EXCEEDS_TOTAL",
                    "O cashback aplicado não pode exceder o valor total do agendamento.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        return amount;
    }

    private void validateServiceIds(List<UUID> serviceIds) {
        if (serviceIds == null || serviceIds.isEmpty()) {
            throw new BusinessException(
                    "SERVICES_REQUIRED", "Selecione pelo menos um serviço.", HttpStatus.BAD_REQUEST);
        }
        if (new HashSet<>(serviceIds).size() != serviceIds.size()) {
            throw new BusinessException(
                    "DUPLICATE_SERVICES", "Um serviço não pode ser selecionado mais de uma vez.", HttpStatus.BAD_REQUEST);
        }
    }

    private BusinessException slotConflict() {
        return new BusinessException(
                "SLOT_ALREADY_BOOKED",
                "O horário selecionado acabou de ser reservado. Por favor, escolha outra opção.",
                HttpStatus.CONFLICT);
    }

    private Appointment initializeForResponse(Appointment appointment) {
        appointment.getServices().size();
        return appointment;
    }
}

record CreateAppointmentCommand(
        UUID barberId,
        List<UUID> serviceIds,
        OffsetDateTime startTimestamp,
        boolean useCashback,
        BigDecimal cashbackAmountToApply,
        PaymentMethod paymentMethod) {}

record AppointmentCreationResult(Appointment appointment, PaymentGateway.PaymentIntent paymentIntent) {}
