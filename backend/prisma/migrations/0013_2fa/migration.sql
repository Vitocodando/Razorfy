-- FEAT-076: 2FA TOTP. Segredo armazenado criptografado (AES-256-GCM) em totp_secret.
ALTER TABLE users ADD COLUMN is_2fa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);
