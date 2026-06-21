import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { encryptSecret, decryptSecret } from '../common/crypto';
import { generateSecret, buildOtpAuthUri, verifyCode } from '../auth/twofa.service';

const FUTURE_BLOCKING = ['CONFIRMED', 'PENDING_PAYMENT'];

function publicUser(u: {
  id: string; name: string; email: string; phone: string | null;
  notificationPushEnabled: boolean; notificationWhatsappEnabled: boolean;
}) {
  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    notificationPushEnabled: u.notificationPushEnabled,
    notificationWhatsappEnabled: u.notificationWhatsappEnabled,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  // RN03: nunca expõe totp_secret; apenas o flag de status.
  return { ...publicUser(user), role: user.role, hasPassword: user.password !== null, is2faEnabled: user.is2faEnabled };
}

// FEAT-076 RF01: gera segredo TOTP (pendente, criptografado) e a URI otpauth para o QR.
export async function setup2fa(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (user.is2faEnabled) throw new BusinessError('2FA_ALREADY_ENABLED', 'A autenticação em duas etapas já está ativa.', 409);

  const secret = generateSecret();
  const tenant = user.tenantId
    ? await prisma.barbershop.findUnique({ where: { id: user.tenantId }, select: { name: true } })
    : null;
  const otpAuthUri = buildOtpAuthUri(secret, user.email, tenant?.name);

  // Persiste o segredo criptografado como pendente (is2faEnabled permanece false).
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret) } });
  return { otpAuthUri, manualSecretKey: secret };
}

// RF02 / RN02: ativa o 2FA somente após provar o primeiro código válido.
export async function enable2fa(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (user.is2faEnabled) throw new BusinessError('2FA_ALREADY_ENABLED', 'A autenticação em duas etapas já está ativa.', 409);
  if (!user.totpSecret) throw new BusinessError('2FA_SETUP_REQUIRED', 'Inicie a configuração do 2FA antes de ativar.', 409);

  if (!verifyCode(code, decryptSecret(user.totpSecret))) {
    throw new BusinessError('INVALID_TOTP_CODE', 'Código inválido. Verifique o app autenticador.', 401);
  }
  await prisma.user.update({ where: { id: userId }, data: { is2faEnabled: true } });
}

// RF03 / CT02: desativa exigindo senha atual E código TOTP válido (prova de posse do dispositivo).
export async function disable2fa(userId: string, currentPassword: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (!user.is2faEnabled || !user.totpSecret) {
    throw new BusinessError('2FA_NOT_ENABLED', 'A autenticação em duas etapas não está ativa.', 409);
  }
  if (!user.password || !(await bcrypt.compare(currentPassword, user.password))) {
    throw new BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
  }
  if (!verifyCode(code, decryptSecret(user.totpSecret))) {
    throw new BusinessError('INVALID_TOTP_CODE', 'Código inválido. Verifique o app autenticador.', 401);
  }
  await prisma.user.update({ where: { id: userId }, data: { is2faEnabled: false, totpSecret: null } });
}

// RF01: atualiza nome/telefone e preferências de notificação. user_id vem do JWT (anti-IDOR).
export async function updateProfile(userId: string, data: {
  name?: string; phone?: string;
  notificationPushEnabled?: boolean; notificationWhatsappEnabled?: boolean;
}) {
  if (data.phone) {
    const taken = await prisma.user.findFirst({ where: { phone: data.phone, id: { not: userId } } });
    if (taken) throw new BusinessError('DUPLICATE_PHONE', 'Este telefone já está em uso.', 422);
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.notificationPushEnabled !== undefined ? { notificationPushEnabled: data.notificationPushEnabled } : {}),
      ...(data.notificationWhatsappEnabled !== undefined ? { notificationWhatsappEnabled: data.notificationWhatsappEnabled } : {}),
    },
  });
  return publicUser(updated);
}

// RF02 / V02 / RN04: troca de senha exige currentPassword válido; nova não pode ser igual.
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (!user.password) {
    throw new BusinessError('CURRENT_PASSWORD_INVALID', 'Esta conta usa login social e não possui senha local.', 401);
  }
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
  if (await bcrypt.compare(newPassword, user.password)) {
    throw new BusinessError('SAME_PASSWORD', 'A nova senha deve ser diferente da atual.', 422);
  }
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 12) } });
}

// RF03 / RN01 / RN02 / V03: anonimização LGPD do cliente (soft-delete + PII mascarado + carteira zerada).
export async function anonymizeAccount(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (user.role !== 'CLIENT') {
    throw new BusinessError('CLIENT_REQUIRED', 'Apenas contas de cliente podem ser excluídas por aqui.', 403);
  }
  if (!user.password || !(await bcrypt.compare(currentPassword, user.password))) {
    throw new BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
  }

  const future = await prisma.appointment.count({
    where: { clientId: userId, status: { in: FUTURE_BLOCKING }, startTimestamp: { gt: new Date() } },
  });
  if (future > 0) {
    throw new BusinessError('HAS_PENDING_APPOINTMENTS', 'Cancele seus agendamentos futuros antes de excluir a conta.', 422);
  }

  // V03: e-mail/telefone são UNIQUE — substitui por valores aleatórios para não violar a constraint.
  const token = randomUUID();
  // Senha vira hash aleatório inutilizável (conta fica inativa); satisfaz chk_users_auth_method.
  const deadPassword = await bcrypt.hash(randomUUID(), 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Cliente Anônimo',
        email: `deleted-${token}@anonymized.local`,
        phone: `del-${token.slice(0, 12)}`,
        password: deadPassword,
        googleId: null,
        isActive: false,
        isAnonymized: true,
      },
    }),
    prisma.cashbackWallet.updateMany({
      where: { clientId: userId },
      data: { balance: 0, reservedBalance: 0, version: { increment: 1 } },
    }),
  ]);
}
