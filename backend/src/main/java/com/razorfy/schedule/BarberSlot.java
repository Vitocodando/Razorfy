package com.razorfy.schedule;

import com.razorfy.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "barber_slots")
public class BarberSlot {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barber_id")
    private User barber;

    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "lunch_start")
    private LocalTime lunchStart;

    @Column(name = "lunch_end")
    private LocalTime lunchEnd;

    protected BarberSlot() {}

    BarberSlot(LocalTime startTime, LocalTime endTime, LocalTime lunchStart, LocalTime lunchEnd) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.lunchStart = lunchStart;
        this.lunchEnd = lunchEnd;
    }

    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public LocalTime getLunchStart() { return lunchStart; }
    public LocalTime getLunchEnd() { return lunchEnd; }
}
