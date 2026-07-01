-- FEAT-087: Gestão de Custos Fixos e Fluxo de Caixa.
-- 3 tabelas: expense_categories (categorias globais + por tenant), fixed_costs (moldes),
-- payables (contas a pagar/instâncias). Segue o padrão multi-tenant do projeto.

-- ---------- expense_categories ----------
CREATE TABLE expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL,
  color_hex  VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = categoria global imutável; preenchido = exclusiva do tenant (RN02).
  tenant_id  UUID REFERENCES barbershops(id)
);
CREATE INDEX expense_categories_tenant_id_idx ON expense_categories (tenant_id);

-- ---------- fixed_costs (molde) ----------
CREATE TABLE fixed_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  description VARCHAR(100) NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  due_day     INT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id   UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id),
  CONSTRAINT fixed_costs_amount_positive CHECK (amount > 0),
  CONSTRAINT fixed_costs_due_day_range CHECK (due_day BETWEEN 1 AND 31)
);
CREATE INDEX fixed_costs_tenant_active_idx ON fixed_costs (tenant_id, is_active);

-- ---------- payables (conta a pagar / instância) ----------
CREATE TABLE payables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_cost_id UUID REFERENCES fixed_costs(id),
  description   VARCHAR(100) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  due_date      DATE NOT NULL,
  status        VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id     UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001' REFERENCES barbershops(id),
  CONSTRAINT payables_status_valid CHECK (status IN ('PENDING', 'PAID')),
  CONSTRAINT payables_amount_positive CHECK (amount > 0)
);
CREATE INDEX payables_tenant_status_paid_idx ON payables (tenant_id, status, paid_at);
CREATE INDEX payables_tenant_due_idx ON payables (tenant_id, due_date);
CREATE INDEX payables_fixed_cost_due_idx ON payables (fixed_cost_id, due_date);

-- Evita geração duplicada de instância do mesmo molde no mesmo mês (motor idempotente).
CREATE UNIQUE INDEX payables_fixed_cost_month_uniq
  ON payables (fixed_cost_id, date_trunc('month', due_date))
  WHERE fixed_cost_id IS NOT NULL;

-- FEAT-086: RLS habilitado (sem policy) — nega a API REST pública do Supabase; Prisma (dono) bypassa.
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables           ENABLE ROW LEVEL SECURITY;

-- Seed de categorias globais imutáveis (tenant_id NULL) — RN02.
INSERT INTO expense_categories (name, color_hex, tenant_id) VALUES
  ('Aluguel',   '#b8412f', NULL),
  ('Água',      '#2f6fb8', NULL),
  ('Luz',       '#e0a812', NULL),
  ('Internet',  '#3f9d6a', NULL),
  ('Salários',  '#8b5cf6', NULL),
  ('Produtos',  '#64748b', NULL),
  ('Impostos',  '#dc2626', NULL);
