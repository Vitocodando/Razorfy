package com.razorfy.payment;

import com.razorfy.appointment.Appointment;

public interface PaymentGateway {
    PaymentIntent createIntent(Appointment appointment);
    void refund(Appointment appointment);

    record PaymentIntent(String reference, String qrCodeBase64, String copyPasteCode) {}
}
