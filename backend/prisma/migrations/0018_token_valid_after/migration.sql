-- SEC (FEAT-088): revogação de sessão stateless.
-- JWTs com iat anterior a token_valid_after são rejeitados no authenticate.
-- Setado no logout e na troca de senha; NULL = nenhum token revogado (comportamento padrão).
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_valid_after TIMESTAMPTZ;
