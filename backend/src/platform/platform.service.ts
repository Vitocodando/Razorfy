import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { invalidateTenantActiveCache } from '../middleware/authenticate';
import { normalizeE164, formatPhoneBR } from '../common/phone';
import { decryptSecret } from '../common/crypto';
import { verifyCode } from '../auth/twofa.service';
import type { CreateTenantInput, UpdateUserInput } from './platform.schemas';

const EDITABLE_ROLES = ['CLIENT', 'BARBER', 'ADMIN'] as const;

function userView(u: { id: string; name: string; phone: string | null; email: string | null; role: string; isActive: boolean }) {
  return {
    userId: u.id,
    name: u.name,
    phone: u.phone,
    formattedPhone: formatPhoneBR(u.phone),
    email: u.email,
    role: u.role,
    isActive: u.isActive,
  };
}

// FEAT-084 RF01: usuários de um tenant, paginado.
export async function listTenantUsers(tenantId: string, page: number, size: number) {
  const shop = await prisma.barbershop.findUnique({ where: { id: tenantId }, select: { name: true } });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);

  const [totalElements, users] = await prisma.$transaction([
    prisma.user.count({ where: { tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      skip: page * size,
      take: size,
      select: { id: true, name: true, phone: true, email: true, role: true, isActive: true },
    }),
  ]);
  return { tenantName: shop.name, content: users.map(userView), totalPages: Math.ceil(totalElements / size), totalElements };
}

// CT02: busca global inter-tenant por nome ou telefone; expõe o tenant de cada registro.
export async function searchUsers(q: string) {
  const term = q.trim();
  const digits = term.replace(/\D/g, '');
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'DEV' },
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } as Prisma.StringFilter }] : []),
      ],
    },
    orderBy: { name: 'asc' },
    take: 50,
    select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, tenantId: true },
  });
  const tenantIds = [...new Set(users.map(u => u.tenantId).filter(Boolean) as string[])];
  const shops = tenantIds.length
    ? await prisma.barbershop.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(shops.map(s => [s.id, s.name]));
  return users.map(u => ({ ...userView(u), tenantId: u.tenantId, tenantName: u.tenantId ? nameById.get(u.tenantId) ?? null : null }));
}

// RF03/RN02/RN03/V01: atualização administrativa de um usuário.
export async function updateUser(userId: string, data: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);

  // RN03/CT01: bloqueia escalada para DEV.
  if (data.role === 'DEV') {
    throw new BusinessError('ROLE_DEV_FORBIDDEN', 'A role DEV só pode ser atribuída via infraestrutura central da plataforma.', 400);
  }
  if (!EDITABLE_ROLES.includes(data.role as (typeof EDITABLE_ROLES)[number])) {
    throw new BusinessError('INVALID_ROLE', 'Cargo inválido.', 400);
  }
  if (user.role === 'DEV') {
    throw new BusinessError('CANNOT_EDIT_DEV', 'Usuário da plataforma não pode ser editado por aqui.', 403);
  }

  // RN02: telefone sanitizado para E.164.
  const phone = normalizeE164(data.phone);
  const email = data.email?.trim() ? data.email.trim().toLowerCase() : null;

  // V01: conflito de telefone no MESMO tenant.
  const phoneConflict = await prisma.user.findFirst({ where: { tenantId: user.tenantId, phone, id: { not: userId } } });
  if (phoneConflict) throw new BusinessError('PHONE_ALREADY_EXISTS', 'Este telefone já está em uso por outro usuário desta barbearia.', 422);
  if (email) {
    const emailConflict = await prisma.user.findFirst({ where: { tenantId: user.tenantId, email: { equals: email, mode: 'insensitive' }, id: { not: userId } } });
    if (emailConflict) throw new BusinessError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está em uso por outro usuário desta barbearia.', 422);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name.trim(), phone, email, role: data.role, isActive: data.isActive },
    select: { id: true, name: true, phone: true, role: true },
  });
  return { userId: updated.id, name: updated.name, phone: updated.phone, role: updated.role, status: 'UPDATED_BY_PLATFORM_ADMIN' };
}

// FEAT-085: anti-replay (V02) — código já usado fica bloqueado por 30s.
const usedDevCodes = new Map<string, number>();
function assertCodeNotReplayed(devUserId: string, code: string) {
  const k = `${devUserId}:${code}`;
  const now = Date.now();
  const exp = usedDevCodes.get(k);
  if (exp && exp > now) {
    throw new BusinessError('DUPLICATE_2FA_CODE', 'Este código já foi utilizado. Aguarde gerar um novo.', 409);
  }
}
function markCodeUsed(devUserId: string, code: string) {
  usedDevCodes.set(`${devUserId}:${code}`, Date.now() + 30_000);
}

// FEAT-085: exclusão permanente de um tenant, blindada pelo 2FA do próprio DEV.
// Purga em cascata (transação) todas as tabelas com aquele tenant_id (RN04 atomicidade).
export async function deleteTenant(devUserId: string, tenantId: string, code: string, ip: string) {
  const dev = await prisma.user.findUnique({ where: { id: devUserId }, select: { is2faEnabled: true, totpSecret: true } });

  // RN01: DEV precisa ter 2FA ativo.
  if (!dev?.is2faEnabled || !dev.totpSecret) {
    throw new BusinessError('DEV_2FA_NOT_CONFIGURED', 'Operação bloqueada. Sua conta de Desenvolvedor precisa ter o 2FA ativado nas configurações antes de executar exclusões de Tenants.', 403);
  }

  assertCodeNotReplayed(devUserId, code); // V02

  // RN02: tolerância de drift já embutida em verifyCode (±30s).
  if (!verifyCode(code, decryptSecret(dev.totpSecret))) {
    console.warn(`[CRITICAL] TENANT_DELETE_FAILED dev=${devUserId} tenant=${tenantId} ip=${ip} reason=invalid_2fa at=${new Date().toISOString()}`);
    throw new BusinessError('INVALID_DEV_2FA_CODE', 'O código do aplicativo de autenticação está incorreto ou expirou. A exclusão foi abortada por segurança.', 401);
  }

  const shop = await prisma.barbershop.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);

  const w = { tenantId };
  // Ordem: filhas → pais. RN04: tudo numa transação (rollback total em falha).
  await prisma.$transaction([
    prisma.appointmentStatusHistory.deleteMany({ where: w }),
    prisma.notificationOutbox.deleteMany({ where: w }),
    prisma.cashbackTransaction.deleteMany({ where: w }),
    prisma.appointmentService.deleteMany({ where: w }),
    prisma.review.deleteMany({ where: w }),
    prisma.adminAlert.deleteMany({ where: w }),
    prisma.barberGoal.deleteMany({ where: w }),
    prisma.clientNote.deleteMany({ where: w }),
    prisma.scheduleBlock.deleteMany({ where: w }),
    prisma.vacationBlock.deleteMany({ where: w }),
    prisma.barberSlot.deleteMany({ where: w }),
    prisma.cashbackWallet.deleteMany({ where: w }),
    prisma.appointment.deleteMany({ where: w }),
    prisma.coupon.deleteMany({ where: w }),
    prisma.dailyAdminReport.deleteMany({ where: w }),
    prisma.globalSettings.deleteMany({ where: w }),
    prisma.service.deleteMany({ where: w }),
    prisma.serviceIcon.deleteMany({ where: w }), // só ícones privados do tenant (globais têm tenant_id NULL)
    prisma.user.deleteMany({ where: w }),
    prisma.barbershop.delete({ where: { id: tenantId } }),
  ]);

  invalidateTenantActiveCache(tenantId);
  markCodeUsed(devUserId, code); // V02
  // RN03: auditoria crítica.
  console.warn(`[CRITICAL] TENANT_DELETED dev=${devUserId} tenant=${tenantId} name="${shop.name}" ip=${ip} at=${new Date().toISOString()}`);
}

// RN04: reset de senha — gera senha temporária aleatória, persiste o hash, exibe 1x em texto plano.
export async function forcePasswordReset(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
  if (user.role === 'DEV') throw new BusinessError('CANNOT_EDIT_DEV', 'Usuário da plataforma não pode ser editado por aqui.', 403);

  // 8 caracteres alfanuméricos sem ambíguos.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const temporaryPassword = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(temporaryPassword, 12) } });

  return {
    userId,
    temporaryPassword,
    message: 'A senha foi resetada e criptografada. Forneça a senha temporária acima para o usuário.',
  };
}

// RF01: listagem global paginada de tenants + contato do admin (dono).
export async function listTenants(page: number, size: number) {
  const [totalElements, shops] = await prisma.$transaction([
    prisma.barbershop.count(),
    prisma.barbershop.findMany({
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
      select: { id: true, name: true, connectionCode: true, isActive: true, createdAt: true },
    }),
  ]);

  // Contato do dono (primeiro ADMIN de cada tenant) — busca única evita N+1.
  const ids = shops.map(s => s.id);
  const admins = ids.length
    ? await prisma.user.findMany({
        where: { tenantId: { in: ids }, role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { tenantId: true, name: true, email: true, phone: true },
      })
    : [];
  const adminByTenant = new Map<string, { name: string; email: string | null; phone: string | null }>();
  for (const a of admins) {
    if (a.tenantId && !adminByTenant.has(a.tenantId)) {
      adminByTenant.set(a.tenantId, { name: a.name, email: a.email, phone: a.phone });
    }
  }

  return {
    content: shops.map(s => ({
      tenantId: s.id,
      name: s.name,
      connectionCode: s.connectionCode,
      isActive: s.isActive,
      createdAt: s.createdAt,
      adminContact: adminByTenant.get(s.id) ?? null,
    })),
    totalPages: Math.ceil(totalElements / size),
    totalElements,
  };
}

// RF02/RN03: onboarding transacional — barbearia + usuário-mestre (ADMIN) atômicos.
export async function createTenant(input: CreateTenantInput) {
  const { tenant, adminUser } = input;

  // V03: connection_code único em TODA a tabela (ativo ou inativo).
  const dupCode = await prisma.barbershop.findUnique({ where: { connectionCode: tenant.connectionCode } });
  if (dupCode) {
    throw new BusinessError('DUPLICATE_CONNECTION_CODE', `O código de conexão "${tenant.connectionCode}" já está em uso.`, 422);
  }
  const dupSlug = await prisma.barbershop.findUnique({ where: { slug: tenant.slug } });
  if (dupSlug) {
    throw new BusinessError('DUPLICATE_SLUG', `O identificador (slug) "${tenant.slug}" já está em uso.`, 422);
  }

  const hash = await bcrypt.hash(adminUser.initialPassword, 12);
  try {
    const shop = await prisma.$transaction(async tx => {
      const created = await tx.barbershop.create({
        data: { name: tenant.name, slug: tenant.slug, connectionCode: tenant.connectionCode },
      });
      // V01: role forçada para ADMIN; V02: e-mail único sob o tenant recém-criado.
      await tx.user.create({
        data: {
          name: adminUser.name,
          email: adminUser.email.toLowerCase(),
          phone: adminUser.phone,
          password: hash,
          role: 'ADMIN',
          tenantId: created.id,
        },
      });
      return created;
    });

    return {
      tenantId: shop.id,
      message: 'Barbearia e Usuário Mestre criados com sucesso.',
      tenant: { name: shop.name, connectionCode: shop.connectionCode, isActive: shop.isActive },
    };
  } catch (err) {
    // Conflitos de unicidade conhecidos (corrida) → 422; demais falhas → rollback + 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BusinessError('ONBOARDING_TRANSACTION_FAILED', 'Conflito de dados ao criar o usuário-mestre. A criação foi cancelada.', 422);
    }
    throw new BusinessError('ONBOARDING_TRANSACTION_FAILED', 'Falha ao criar o usuário-mestre. A barbearia não foi criada.', 500);
  }
}

// RF03/FA01: kill-switch — alterna is_active e invalida o cache (efeito imediato).
export async function setTenantStatus(tenantId: string, isActive: boolean) {
  const shop = await prisma.barbershop.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);

  const updated = await prisma.barbershop.update({
    where: { id: tenantId },
    data: { isActive },
    select: { id: true, name: true, connectionCode: true, isActive: true },
  });
  invalidateTenantActiveCache(tenantId);
  return { tenantId: updated.id, name: updated.name, connectionCode: updated.connectionCode, isActive: updated.isActive };
}
