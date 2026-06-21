-- Tenant Discovery por código de conexão + logo.
ALTER TABLE barbershops ADD COLUMN connection_code VARCHAR(10);
ALTER TABLE barbershops ADD COLUMN logo_url VARCHAR(500);

-- Backfill: deriva do slug (uppercase, só alfanumérico, máx 10).
UPDATE barbershops
SET connection_code = UPPER(LEFT(REGEXP_REPLACE(slug, '[^a-zA-Z0-9]', '', 'g'), 10))
WHERE connection_code IS NULL;

ALTER TABLE barbershops ALTER COLUMN connection_code SET NOT NULL;
ALTER TABLE barbershops ADD CONSTRAINT uk_barbershops_connection_code UNIQUE (connection_code);
ALTER TABLE barbershops ADD CONSTRAINT chk_barbershops_connection_code CHECK (connection_code ~ '^[A-Z0-9]+$');
