"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.setup2fa = setup2fa;
exports.enable2fa = enable2fa;
exports.disable2fa = disable2fa;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
exports.anonymizeAccount = anonymizeAccount;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
const crypto_2 = require("../common/crypto");
const twofa_service_1 = require("../auth/twofa.service");
const FUTURE_BLOCKING = ['CONFIRMED', 'PENDING_PAYMENT'];
function publicUser(u) {
    return {
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        notificationPushEnabled: u.notificationPushEnabled,
        notificationWhatsappEnabled: u.notificationWhatsappEnabled,
    };
}
async function getMe(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    // RN03: nunca expõe totp_secret; apenas o flag de status.
    return { ...publicUser(user), role: user.role, hasPassword: user.password !== null, is2faEnabled: user.is2faEnabled };
}
// FEAT-076 RF01: gera segredo TOTP (pendente, criptografado) e a URI otpauth para o QR.
async function setup2fa(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (user.is2faEnabled)
        throw new BusinessError_1.BusinessError('2FA_ALREADY_ENABLED', 'A autenticação em duas etapas já está ativa.', 409);
    const secret = (0, twofa_service_1.generateSecret)();
    const tenant = user.tenantId
        ? await prisma_1.prisma.barbershop.findUnique({ where: { id: user.tenantId }, select: { name: true } })
        : null;
    const otpAuthUri = (0, twofa_service_1.buildOtpAuthUri)(secret, user.email ?? user.phone ?? user.id, tenant?.name);
    // Persiste o segredo criptografado como pendente (is2faEnabled permanece false).
    await prisma_1.prisma.user.update({ where: { id: userId }, data: { totpSecret: (0, crypto_2.encryptSecret)(secret) } });
    return { otpAuthUri, manualSecretKey: secret };
}
// RF02 / RN02: ativa o 2FA somente após provar o primeiro código válido.
async function enable2fa(userId, code) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (user.is2faEnabled)
        throw new BusinessError_1.BusinessError('2FA_ALREADY_ENABLED', 'A autenticação em duas etapas já está ativa.', 409);
    if (!user.totpSecret)
        throw new BusinessError_1.BusinessError('2FA_SETUP_REQUIRED', 'Inicie a configuração do 2FA antes de ativar.', 409);
    if (!(0, twofa_service_1.verifyCode)(code, (0, crypto_2.decryptSecret)(user.totpSecret))) {
        throw new BusinessError_1.BusinessError('INVALID_TOTP_CODE', 'Código inválido. Verifique o app autenticador.', 401);
    }
    await prisma_1.prisma.user.update({ where: { id: userId }, data: { is2faEnabled: true } });
}
// RF03 / CT02: desativa exigindo senha atual E código TOTP válido (prova de posse do dispositivo).
async function disable2fa(userId, currentPassword, code) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (!user.is2faEnabled || !user.totpSecret) {
        throw new BusinessError_1.BusinessError('2FA_NOT_ENABLED', 'A autenticação em duas etapas não está ativa.', 409);
    }
    if (!user.password || !(await bcrypt_1.default.compare(currentPassword, user.password))) {
        throw new BusinessError_1.BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
    }
    if (!(0, twofa_service_1.verifyCode)(code, (0, crypto_2.decryptSecret)(user.totpSecret))) {
        throw new BusinessError_1.BusinessError('INVALID_TOTP_CODE', 'Código inválido. Verifique o app autenticador.', 401);
    }
    await prisma_1.prisma.user.update({ where: { id: userId }, data: { is2faEnabled: false, totpSecret: null } });
}
// RF01: atualiza nome/telefone e preferências de notificação. user_id vem do JWT (anti-IDOR).
async function updateProfile(userId, data) {
    if (data.phone) {
        const taken = await prisma_1.prisma.user.findFirst({ where: { phone: data.phone, id: { not: userId } } });
        if (taken)
            throw new BusinessError_1.BusinessError('DUPLICATE_PHONE', 'Este telefone já está em uso.', 422);
    }
    const updated = await prisma_1.prisma.user.update({
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
async function changePassword(userId, currentPassword, newPassword) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (!user.password) {
        throw new BusinessError_1.BusinessError('CURRENT_PASSWORD_INVALID', 'Esta conta usa login social e não possui senha local.', 401);
    }
    const valid = await bcrypt_1.default.compare(currentPassword, user.password);
    if (!valid)
        throw new BusinessError_1.BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
    if (await bcrypt_1.default.compare(newPassword, user.password)) {
        throw new BusinessError_1.BusinessError('SAME_PASSWORD', 'A nova senha deve ser diferente da atual.', 422);
    }
    await prisma_1.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt_1.default.hash(newPassword, 12) } });
}
// RF03 / RN01 / RN02 / V03: anonimização LGPD do cliente (soft-delete + PII mascarado + carteira zerada).
async function anonymizeAccount(userId, currentPassword) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (user.role !== 'CLIENT') {
        throw new BusinessError_1.BusinessError('CLIENT_REQUIRED', 'Apenas contas de cliente podem ser excluídas por aqui.', 403);
    }
    if (!user.password || !(await bcrypt_1.default.compare(currentPassword, user.password))) {
        throw new BusinessError_1.BusinessError('CURRENT_PASSWORD_INVALID', 'Senha atual incorreta.', 401);
    }
    const future = await prisma_1.prisma.appointment.count({
        where: { clientId: userId, status: { in: FUTURE_BLOCKING }, startTimestamp: { gt: new Date() } },
    });
    if (future > 0) {
        throw new BusinessError_1.BusinessError('HAS_PENDING_APPOINTMENTS', 'Cancele seus agendamentos futuros antes de excluir a conta.', 422);
    }
    // V03: e-mail/telefone são UNIQUE — substitui por valores aleatórios para não violar a constraint.
    const token = (0, crypto_1.randomUUID)();
    // Senha vira hash aleatório inutilizável (conta fica inativa); satisfaz chk_users_auth_method.
    const deadPassword = await bcrypt_1.default.hash((0, crypto_1.randomUUID)(), 12);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
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
        prisma_1.prisma.cashbackWallet.updateMany({
            where: { clientId: userId },
            data: { balance: 0, reservedBalance: 0, version: { increment: 1 } },
        }),
    ]);
}
