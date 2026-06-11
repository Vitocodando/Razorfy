package com.razorfy.notification;

import com.razorfy.config.RazorfyProperties;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

@Component
public class OutboxProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(OutboxProcessor.class);
    private final NotificationOutboxRepository outbox;
    private final RazorfyProperties properties;
    private final RestClient restClient;
    private final Clock clock;

    public OutboxProcessor(
            NotificationOutboxRepository outbox,
            RazorfyProperties properties,
            RestClient.Builder restClientBuilder,
            Clock clock) {
        this.outbox = outbox;
        this.properties = properties;
        this.restClient = restClientBuilder.build();
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void process() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (NotificationOutbox message : outbox
                .findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAt(
                        NotificationOutbox.Status.PENDING, now)) {
            try {
                send(message);
                message.markSent(now);
            } catch (RuntimeException exception) {
                message.markFailed(
                        exception.getMessage(),
                        now.plusMinutes(5),
                        properties.notifications().maxAttempts());
                LOGGER.warn("Falha ao enviar notificação {}: {}", message.getEventType(), exception.getMessage());
            }
        }
    }

    private void send(NotificationOutbox message) {
        if (message.getChannel() == NotificationOutbox.Channel.PUSH) {
            LOGGER.info("Push local enviado para {}: {}", message.getDestination(), message.getEventType());
            return;
        }
        String url = properties.notifications().whatsappUrl();
        if (url == null || url.isBlank()) {
            LOGGER.info("WhatsApp simulado para {}: {}", message.getDestination(), message.getEventType());
            return;
        }
        restClient.post()
                .uri(url)
                .body(MapPayload.of(message))
                .retrieve()
                .toBodilessEntity();
    }

    private record MapPayload(String to, String event, Object payload) {
        static MapPayload of(NotificationOutbox message) {
            return new MapPayload(message.getDestination(), message.getEventType(), message.getPayload());
        }
    }
}
