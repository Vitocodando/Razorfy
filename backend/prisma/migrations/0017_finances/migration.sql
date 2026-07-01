-- FEAT-087: Gestão de Custos Fixos e Fluxo de Caixa.
-- 3 tabelas: expense_categories (categorias globais + por tenant), fixed_costs (moldes),
-- payables (contas a pagar/instâncias). Idempotente (IF NOT EXISTS) para re-run seguro após P3009.

-- ---------- expense_categories ----------
CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL,
  color_hex  VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = categoria global imutável; preenchido = exclusiva do tenant (RN02).
  tenant_id  UUID REFERENCES barbershops(id)
);
CREATE INDEX IF NOT EXISTS expense_categories_tenant_id_idx ON expense_categories (tenant_id);

-- ---------- fixed_costs (molde) ----------
CREATE TABLE IF NOT EXISTS fixed_costs (
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
CREATE INDEX IF NOT EXISTS fixed_costs_tenant_active_idx ON fixed_costs (tenant_id, is_active);

-- ---------- payables (conta a pagar / instância) ----------
CREATE TABLE IF NOT EXISTS payables (
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
CREATE INDEX IF NOT EXISTS payables_tenant_status_paid_idx ON payables (tenant_id, status, paid_at);
CREATE INDEX IF NOT EXISTS payables_tenant_due_idx ON payables (tenant_id, due_date);

-- Uma instância por molde por data de vencimento (motor idempotente).
-- due_date é determinístico por (molde, mês) → equivale a "1 por mês" sem expressão não-IMMUTABLE.
CREATE UNIQUE INDEX IF NOT EXISTS payables_fixed_cost_due_uniq ON payables (fixed_cost_id, due_date);

-- FEAT-086: RLS habilitado (sem policy) — nega a API REST pública do Supabase; Prisma (dono) bypassa.
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables           ENABLE ROW LEVEL SECURITY;

-- Seed de categorias globais imutáveis (tenant_id NULL) — RN02. Só semeia se ainda não houver globais.
INSERT INTO expense_categories (name, color_hex, tenant_id)
SELECT * FROM (VALUES
  ('Aluguel',  '#b8412f', NULL::uuid),
  ('Água',     '#2f6fb8', NULL::uuid),
  ('Luz',      '#e0a812', NULL::uuid),
  ('Internet', '#3f9d6a', NULL::uuid),
  ('Salários', '#8b5cf6', NULL::uuid),
  ('Produtos', '#64748b', NULL::uuid),
  ('Impostos', '#dc2626', NULL::uuid)
) AS seed(name, color_hex, tenant_id)
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE tenant_id IS NULL);
