-- Modulo do Administrador (Dono): cupons, comissoes, ferias, alertas, BI e no-show.

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN (
    'PENDING_PAYMENT', 'CONFIRMED', 'CONCLUDED', 'CANCELLED',
    'EXPIRED_PAYMENT', 'CANCELLED_OVERBOOKING', 'NO_SHOW'
));

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    discount_type VARCHAR(15) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_VALUE')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    max_uses_global INT CHECK (max_uses_global IS NULL OR max_uses_global > 0),
    current_uses INT NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (code ~ '^[A-Z0-9]{1,20}$'),
    CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100),
    CHECK (expires_at > created_at),
    CHECK (max_uses_global IS NULL OR current_uses <= max_uses_global)
);
CREATE INDEX idx_coupons_expires ON coupons (expires_at);

ALTER TABLE appointments
    ADD COLUMN coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    ADD COLUMN coupon_code VARCHAR(20),
    ADD COLUMN coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_check1;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_check2;
ALTER TABLE appointments ADD CONSTRAINT appointments_cashback_lte_total CHECK (cashback_used <= total_price);
ALTER TABLE appointments ADD CONSTRAINT appointments_discount_lte_total CHECK (coupon_discount <= total_price);
ALTER TABLE appointments ADD CONSTRAINT appointments_amount_paid_calculation CHECK (amount_paid = total_price - cashback_used - coupon_discount);

ALTER TABLE cashback_transactions DROP CONSTRAINT IF EXISTS cashback_transactions_type_check;
ALTER TABLE cashback_transactions ADD CONSTRAINT cashback_transactions_type_check CHECK (type IN (
    'CREDIT', 'DEBIT', 'RESERVE', 'RELEASE', 'PENALTY_NO_SHOW'
));

CREATE TABLE barber_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES users(id),
    service_id UUID NOT NULL REFERENCES services(id),
    commission_pct NUMERIC(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_barber_commissions_matrix UNIQUE (barber_id, service_id)
);
CREATE INDEX idx_barber_commissions_barber ON barber_commissions (barber_id);

CREATE TABLE vacation_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_vacation_blocks_barber_dates ON vacation_blocks (barber_id, start_date, end_date);

CREATE TABLE admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('BAD_REVIEW')),
    status VARCHAR(15) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
);
CREATE INDEX idx_admin_alerts_status_created ON admin_alerts (status, created_at);

CREATE TABLE daily_admin_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    gross_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
    concluded_appointments INT NOT NULL DEFAULT 0,
    no_show_appointments INT NOT NULL DEFAULT 0,
    average_ticket NUMERIC(10,2) NOT NULL DEFAULT 0,
    estimated_ltv NUMERIC(10,2) NOT NULL DEFAULT 0,
    idle_minutes INT NOT NULL DEFAULT 0,
    occupancy_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    heatmap JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_admin_reports_date ON daily_admin_reports (report_date);
