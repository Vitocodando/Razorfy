-- FEAT-077: autenticação por telefone (OTP). E-mail passa a ser opcional;
-- conta verificada por telefone é um meio de auth válido.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN is_phone_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users DROP CONSTRAINT chk_users_auth_method;
ALTER TABLE users ADD CONSTRAINT chk_users_auth_method
  CHECK (password IS NOT NULL OR google_id IS NOT NULL OR is_phone_verified = true);
