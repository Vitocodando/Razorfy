-- Módulo de Configurações: preferências de notificação + anonimização LGPD + settings globais.

ALTER TABLE users ADD COLUMN notification_push_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN notification_whatsapp_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN is_anonymized BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE global_settings (
    id INT PRIMARY KEY DEFAULT 1,
    no_show_tolerance_minutes INT NOT NULL DEFAULT 15 CHECK (no_show_tolerance_minutes BETWEEN 5 AND 60),
    default_cashback_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (default_cashback_pct >= 0 AND default_cashback_pct <= 100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT global_settings_singleton CHECK (id = 1)
);
INSERT INTO global_settings (id) VALUES (1);
