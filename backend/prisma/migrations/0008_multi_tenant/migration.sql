-- SaaS Multi-Tenant Fase 1: entidade barbershops + tenant_id em todas as tabelas de negócio.
-- tenant_id NOT NULL DEFAULT (tenant default) preenche linhas existentes e mantém inserts legados válidos.

CREATE TABLE barbershops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO barbershops (id, name, slug)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Razorfy', 'razorfy');

-- tenant_id em todas as tabelas de negócio
ALTER TABLE users                      ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE services                   ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE barber_slots               ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE appointments               ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE appointment_services       ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE coupons                    ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE barber_commissions         ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE vacation_blocks            ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE cashback_wallets           ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE cashback_transactions      ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE admin_alerts               ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE global_settings            ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE schedule_blocks            ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE barber_goals               ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE client_notes               ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE reviews                    ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE daily_admin_reports        ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE appointment_status_history ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);
ALTER TABLE notification_outbox        ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id);

CREATE INDEX idx_users_tenant ON users (tenant_id);
CREATE INDEX idx_services_tenant ON services (tenant_id);
CREATE INDEX idx_appointments_tenant ON appointments (tenant_id);

-- V02: unicidade composta por tenant (e-mail/telefone/google e cupom).
ALTER TABLE users DROP CONSTRAINT IF EXISTS uk_users_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS uk_users_phone;
ALTER TABLE users DROP CONSTRAINT IF EXISTS uk_users_google_id;
ALTER TABLE users ADD CONSTRAINT uk_users_tenant_email UNIQUE (tenant_id, email);
ALTER TABLE users ADD CONSTRAINT uk_users_tenant_phone UNIQUE (tenant_id, phone);
ALTER TABLE users ADD CONSTRAINT uk_users_tenant_google UNIQUE (tenant_id, google_id);

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
ALTER TABLE coupons ADD CONSTRAINT uk_coupons_tenant_code UNIQUE (tenant_id, code);

-- global_settings deixa de ser singleton (passa a 1 registro por tenant).
ALTER TABLE global_settings DROP CONSTRAINT IF EXISTS global_settings_singleton;
ALTER TABLE global_settings ADD CONSTRAINT uk_global_settings_tenant UNIQUE (tenant_id);
