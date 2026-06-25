import crypto from 'crypto';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { normalizeE164 } from '../common/phone';
import { sendWhatsappText, whatsappConfigured } from '../notification/whatsapp';
import { buildSession } from './auth.service';

// FEAT-077: OTP por telefone. Armazenamento efêmero em memória (NFR: não usar tabela relacional).
// Nota: in-memory funciona para instância única; produção multi-instância → trocar por Redis
// (mesma chave `otp:verification:{tenantId}:{e164}` e TTL de 300s).
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 3;
const SEND_LIMIT = 3;
const SEND_WINDOW_MS = 60 * 60 * 1000;

type OtpEntry = { code: string; attempts: number; expiresAt: number };
const otpStore = new Map<string, OtpEntry>();
const sendTracker = new Map<string, number[]>(); // timestamps de envio por chave

function key(tenantId: string, phone: string): string {
  return `otp:verification:${tenantId}:${phone}`;
}

function generateCode(): string {
  // RN03: 6 dígitos numéricos, geração criptográfica.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Dispara via WhatsApp (WaSenderAPI). Se configurado e falhar → 503 (não grava OTP — RN/Dep).
async function dispatchWhatsapp(phone: string, code: string): Promise<void> {
  if (!whatsappConfigured()) {
    console.log(`[otp] (dev) código para ${phone}: ${code}`);
    return;
  }
  try {
    await sendWhatsappText(phone, `Razorfy: seu código de verificação é ${code}. Válido por 5 minutos. Não compartilhe.`);
  } catch {
    throw new BusinessError('GATEWAY_UNAVAILABLE', 'Serviço de mensagens indisponível. Tente novamente em instantes.', 503);
  }
}

// RN02: rate limit de envios — 3 por hora por (tenant, telefone).
function assertSendAllowed(k: string): void {
  const now = Date.now();
  const recent = (sendTracker.get(k) ?? []).filter(t => now - t < SEND_WINDOW_MS);
  if (recent.length >= SEND_LIMIT) {
    throw new BusinessError('RATE_LIMIT_EXCEEDED', 'Você atingiu o limite de envios de código. Tente novamente em 60 minutos.', 429);
  }
  recent.push(now);
  sendTracker.set(k, recent);
}

export async function sendOtp(tenantId: string, rawPhone: string) {
  const phone = normalizeE164(rawPhone);
  const k = key(tenantId, phone);
  assertSendAllowed(k);

  const code = generateCode();
  await dispatchWhatsapp(phone, code); // só grava após despacho bem-sucedido
  otpStore.set(k, { code, attempts: 0, expiresAt: Date.now() + OTP_TTL_MS });

  return { message: 'Código enviado com sucesso via WhatsApp.', expiresInSeconds: OTP_TTL_MS / 1000, action: 'OTP_DISPATCHED' };
}

export async function verifyOtp(tenantId: string, rawPhone: string, code: string, name?: string) {
  const phone = normalizeE164(rawPhone);
  const k = key(tenantId, phone);
  const entry = otpStore.get(k);

  // RN01/replay: inexistente ou expirado → 410 (chave já destruída no acerto/expiração).
  if (!entry || entry.expiresAt <= Date.now()) {
    otpStore.delete(k);
    throw new BusinessError('OTP_EXPIRED_OR_NOT_FOUND', 'O código expirou ou não foi encontrado. Solicite um novo.', 410);
  }

  if (entry.code !== code) {
    entry.attempts += 1;
    // FA01: 3 erros → invalida a sessão de OTP.
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(k);
      throw new BusinessError('TOO_MANY_OTP_ATTEMPTS', 'Muitas tentativas falhas. Solicite um novo código.', 401);
    }
    throw new BusinessError('OTP_INVALID', 'Código incorreto.', 401);
  }

  // V02: destrói imediatamente após o acerto (anti-replay).
  otpStore.delete(k);

  // RN04: telefone único por tenant.
  const existing = await prisma.user.findFirst({ where: { tenantId, phone } });
  if (existing) {
    if (!existing.isPhoneVerified) {
      await prisma.user.update({ where: { id: existing.id }, data: { isPhoneVerified: true } });
    }
    return { ...buildSession(existing), isNewUser: false };
  }

  // Novo usuário: precisa do nome no primeiro acesso.
  if (!name || name.trim().length < 2) {
    throw new BusinessError('NAME_REQUIRED', 'Informe seu nome para concluir o cadastro.', 422);
  }
  const created = await prisma.user.create({
    data: { name: name.trim(), phone, role: 'CLIENT', tenantId, isPhoneVerified: true },
  });
  return { ...buildSession(created), isNewUser: true };
}
