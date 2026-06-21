-- Multi-tenant Fase 2: relatório diário passa a ser por tenant (unicidade composta).
ALTER TABLE daily_admin_reports DROP CONSTRAINT IF EXISTS daily_admin_reports_report_date_key;
ALTER TABLE daily_admin_reports ADD CONSTRAINT uk_daily_report_tenant_date UNIQUE (tenant_id, report_date);
