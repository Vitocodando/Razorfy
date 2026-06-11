package com.razorfy.payment;

import com.razorfy.appointment.Appointment;
import java.util.Base64;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class MockPaymentGateway implements PaymentGateway {

    private static final Logger LOGGER = LoggerFactory.getLogger(MockPaymentGateway.class);

    @Override
    public PaymentIntent createIntent(Appointment appointment) {
        String reference = "PIX-" + UUID.randomUUID();
        String payload = "000201RAZORFY" + appointment.getId() + appointment.getAmountPaid();
        String qrCode = Base64.getEncoder().encodeToString(payload.getBytes());
        return new PaymentIntent(reference, qrCode, payload);
    }

    @Override
    public void refund(Appointment appointment) {
        LOGGER.info("Estorno simulado para appointment_id={} payment_reference={}",
                appointment.getId(), appointment.getPaymentReference());
    }
}
