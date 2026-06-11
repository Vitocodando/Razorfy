package com.razorfy.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "razorfy")
public record RazorfyProperties(
        String timezone,
        BigDecimal cashbackRate,
        int paymentHoldMinutes,
        Jwt jwt,
        Cors cors,
        Notifications notifications,
        Bootstrap bootstrap) {

    public record Jwt(String secret, long clientExpirationHours, long staffExpirationHours) {}

    public record Cors(String allowedOrigin) {}

    public record Notifications(String whatsappUrl, int maxAttempts) {}

    public record Bootstrap(boolean enabled, String adminEmail, String adminPassword, String staffPassword) {}
}
