package com.razorfy.report;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize("hasAnyRole('ADMIN','DEV')")
public class ReportController {

    private final JdbcTemplate jdbc;

    public ReportController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/summary")
    ReportSummary summary() {
        Map<String, Object> totals = jdbc.queryForMap("""
                SELECT
                    count(*) FILTER (WHERE status = 'CONCLUDED') AS concluded,
                    count(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed,
                    count(*) FILTER (WHERE status IN ('CANCELLED', 'CANCELLED_OVERBOOKING')) AS cancelled,
                    coalesce(sum(amount_paid) FILTER (WHERE status = 'CONCLUDED'), 0) AS revenue
                FROM appointments
                """);
        List<BarberProductivity> productivity = jdbc.query("""
                SELECT u.id, u.name,
                       count(a.id) FILTER (WHERE a.status = 'CONCLUDED') AS concluded,
                       coalesce(sum(a.amount_paid) FILTER (WHERE a.status = 'CONCLUDED'), 0) AS revenue
                FROM users u
                LEFT JOIN appointments a ON a.barber_id = u.id
                WHERE u.role = 'BARBER'
                GROUP BY u.id, u.name
                ORDER BY concluded DESC, u.name
                """, (result, row) -> new BarberProductivity(
                result.getString("id"),
                result.getString("name"),
                result.getLong("concluded"),
                result.getBigDecimal("revenue")));
        return new ReportSummary(
                ((Number) totals.get("concluded")).longValue(),
                ((Number) totals.get("confirmed")).longValue(),
                ((Number) totals.get("cancelled")).longValue(),
                (BigDecimal) totals.get("revenue"),
                productivity);
    }
}

record ReportSummary(
        long concluded,
        long confirmed,
        long cancelled,
        BigDecimal revenue,
        List<BarberProductivity> barberProductivity) {}

record BarberProductivity(String barberId, String barberName, long concluded, BigDecimal revenue) {}
