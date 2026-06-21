-- Multi-tenant Fase 2: global_settings passa a ter tenant_id como PK (1 registro por tenant).
ALTER TABLE global_settings DROP CONSTRAINT IF EXISTS uk_global_settings_tenant;
ALTER TABLE global_settings DROP CONSTRAINT IF EXISTS global_settings_pkey;
ALTER TABLE global_settings DROP COLUMN IF EXISTS id;
ALTER TABLE global_settings ADD PRIMARY KEY (tenant_id);
