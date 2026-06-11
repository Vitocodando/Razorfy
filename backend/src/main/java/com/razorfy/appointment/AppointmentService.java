package com.razorfy.appointment;

import com.razorfy.catalog.ServiceItem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "appointment_services")
@IdClass(AppointmentService.Key.class)
public class AppointmentService {

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    @Id
    @Column(name = "service_id")
    private UUID serviceId;

    @Column(name = "service_name", nullable = false, length = 50)
    private String serviceName;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    protected AppointmentService() {}

    AppointmentService(Appointment appointment, ServiceItem service) {
        this.appointment = appointment;
        this.serviceId = service.getId();
        this.serviceName = service.getName();
        this.durationMinutes = service.getDurationMinutes();
        this.price = service.getPrice();
    }

    public String getServiceName() { return serviceName; }
    public int getDurationMinutes() { return durationMinutes; }
    public BigDecimal getPrice() { return price; }

    public static class Key implements Serializable {
        private UUID appointment;
        private UUID serviceId;

        public Key() {}

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Key key)) return false;
            return Objects.equals(appointment, key.appointment) && Objects.equals(serviceId, key.serviceId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(appointment, serviceId);
        }
    }
}
