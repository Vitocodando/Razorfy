-- FEAT-075: papel DEV (plataforma). DEV não pertence a nenhum tenant.
-- tenant_id passa a aceitar NULL; CHECK garante: role='DEV' <=> tenant_id IS NULL.
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT chk_users_tenant_by_role
  CHECK ((role = 'DEV') = (tenant_id IS NULL));
