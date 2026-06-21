import { generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib';

// RFC 6238 (TOTP) via otplib v13 (API funcional).
// RN01: tolerância de ±30s (epochTolerance simétrico) → aceita o código anterior,
// atual e o seguinte (janela total de 90s).
const EPOCH_TOLERANCE_SECONDS = 30;
const ISSUER_BASE = 'Razorfy';

export function generateSecret(): string {
  return otpGenerateSecret(); // Base32
}

// RN04: issuer carrega o nome da barbearia para identificação no app autenticador.
export function buildOtpAuthUri(secret: string, accountEmail: string, tenantName?: string): string {
  const issuer = tenantName ? `${ISSUER_BASE} (${tenantName})` : ISSUER_BASE;
  return generateURI({ strategy: 'totp', issuer, label: accountEmail, secret });
}

export function verifyCode(code: string, secret: string): boolean {
  try {
    return verifySync({ token: code, secret, epochTolerance: EPOCH_TOLERANCE_SECONDS }).valid;
  } catch {
    return false;
  }
}
