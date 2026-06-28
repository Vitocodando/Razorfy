import { BusinessError } from './BusinessError';

// V01/RF03 (FEAT-077): normaliza para E.164 (assume +55 Brasil quando sem DDI).
export function normalizeE164(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (!raw.trim().startsWith('+') && digits.length <= 11) {
    digits = '55' + digits; // adiciona Brasil
  }
  if (digits.length < 12 || digits.length > 13) {
    throw new BusinessError('INVALID_PHONE', 'Número de telefone inválido.', 422);
  }
  return '+' + digits;
}

// Máscara BR 99 9 9999-9999 a partir de E.164/dígitos (FEAT-084, exibição).
export function formatPhoneBR(e164: string | null): string | null {
  if (!e164) return null;
  let d = e164.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2); // tira DDI para exibir
  if (d.length < 10) return e164;
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

// Classifica um identificador como e-mail ou telefone (login/registro — FEAT-078).
export function classifyIdentifier(identifier: string): { email?: string; phone?: string } {
  const t = identifier.trim();
  if (t.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      throw new BusinessError('INVALID_IDENTIFIER', 'Informe um e-mail ou telefone válido.', 422);
    }
    return { email: t.toLowerCase() };
  }
  return { phone: normalizeE164(t) };
}
