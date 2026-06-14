-- Login social Google (OAuth 2.0 Authorization Code). Usuários OAuth não possuem
-- senha local nem telefone do provedor: relaxa NOT NULL e adiciona identidade google_id.

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE users ADD COLUMN google_id VARCHAR(255);
ALTER TABLE users ADD CONSTRAINT uk_users_google_id UNIQUE (google_id);

-- Integridade: toda conta precisa de ao menos um meio de autenticação (senha local ou Google).
ALTER TABLE users ADD CONSTRAINT chk_users_auth_method
  CHECK (password IS NOT NULL OR google_id IS NOT NULL);
