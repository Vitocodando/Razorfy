CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL CHECK (char_length(name) >= 3),
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'BARBER', 'ADMIN', 'DEV')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_phone UNIQUE (phone)
);

CREATE TABLE barber_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES users(id),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    lunch_start TIME,
    lunch_end TIME,
    CHECK (end_time > start_time),
    CHECK (
        (lunch_start IS NULL AND lunch_end IS NULL)
        OR (lunch_start IS NOT NULL AND lunch_end IS NOT NULL
            AND lunch_start >= start_time AND lunch_end <= end_time
            AND lunch_end > lunch_start)
    ),
    CONSTRAINT uk_barber_slots_day UNIQUE (barber_id, day_of_week)
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cashback_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id),
    balance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    reserved_balance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0 AND reserved_balance <= balance),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_cashback_wallet_client UNIQUE (client_id)
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id),
    barber_id UUID NOT NULL REFERENCES users(id),
    start_timestamp TIMESTAMPTZ NOT NULL,
    end_timestamp TIMESTAMPTZ NOT NULL,
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
    cashback_used NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cashback_used >= 0),
    amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('ONLINE_PIX', 'ONLINE_CARD', 'PRESENTIAL')),
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'PENDING_PAYMENT', 'CONFIRMED', 'CONCLUDED', 'CANCELLED',
        'EXPIRED_PAYMENT', 'CANCELLED_OVERBOOKING'
    )),
    payment_reference VARCHAR(100),
    hold_expires_at TIMESTAMPTZ,
    cashback_credited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (end_timestamp > start_timestamp),
    CHECK (cashback_used <= total_price),
    CHECK (amount_paid = total_price - cashback_used)
);

CREATE TABLE appointment_services (
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    service_name VARCHAR(50) NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (appointment_id, service_id)
);

CREATE TABLE cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES cashback_wallets(id),
    appointment_id UUID REFERENCES appointments(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'RESERVE', 'RELEASE')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(10,2) NOT NULL CHECK (balance_after >= 0),
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(id),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('PUSH', 'WHATSAPP')),
    destination VARCHAR(160) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    last_error VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_barber_time ON appointments (barber_id, start_timestamp, end_timestamp);
CREATE INDEX idx_appointments_client ON appointments (client_id, start_timestamp DESC);
CREATE INDEX idx_outbox_retry ON notification_outbox (status, next_attempt_at);

ALTER TABLE appointments
    ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (
        barber_id WITH =,
        tstzrange(start_timestamp, end_timestamp, '[)') WITH &&
    )
    WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED'));
