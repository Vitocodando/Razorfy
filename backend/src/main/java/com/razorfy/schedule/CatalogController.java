package com.razorfy.schedule;

import com.razorfy.catalog.ServiceItemRepository;
import com.razorfy.user.UserRepository;
import com.razorfy.user.UserRole;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final ServiceItemRepository services;
    private final UserRepository users;
    private final AvailabilityService availability;

    public CatalogController(
            ServiceItemRepository services,
            UserRepository users,
            AvailabilityService availability) {
        this.services = services;
        this.users = users;
        this.availability = availability;
    }

    @GetMapping("/services")
    List<ServiceView> services() {
        return services.findAllByActiveTrueOrderByName().stream()
                .map(service -> new ServiceView(
                        service.getId(), service.getName(), service.getDurationMinutes(), service.getPrice()))
                .toList();
    }

    @GetMapping("/barbers")
    List<BarberView> barbers() {
        return users.findAllByRoleOrderByName(UserRole.BARBER).stream()
                .map(user -> new BarberView(user.getId(), user.getName()))
                .toList();
    }

    @GetMapping("/barbers/{id}/availability")
    AvailabilityResponse availability(
            @PathVariable UUID id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @Min(1) @Max(720) int duration) {
        return new AvailabilityResponse(date, duration, availability.availableStarts(id, date, duration));
    }
}

record ServiceView(UUID id, String name, int durationMinutes, BigDecimal price) {}
record BarberView(UUID id, String name) {}
record AvailabilityResponse(LocalDate date, int durationMinutes, List<OffsetDateTime> availableStarts) {}
