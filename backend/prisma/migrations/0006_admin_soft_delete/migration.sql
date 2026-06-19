-- Módulo Admin: governança por soft-delete de barbeiros (users.is_active).
-- services.active já existe (reutilizado como is_active para serviços).

ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
