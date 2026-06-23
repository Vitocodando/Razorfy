import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../prisma';
import { config, googleOAuthEnabled } from '../config';
import { BusinessError } from '../common/BusinessError';
import { UserRole } from '../user/user.types';
import { decryptSecret } from '../common/crypto';
import { classifyIdentifier } from '../common/phone';
import { verifyCode } from './twofa.service';

const STAFF_ROLES: UserRole[] = ['BARBER', 'ADMIN', 'DEV'];
const DEFAULT_TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PRE_AUTH_TTL_SECONDS = 300; // 5 min (FEAT-076 RN: PRE_AUTH_EXPIRED)

// Rate limiting do verify-2fa (NFR): 5 falhas → bloqueio de 15 min por usuário.
const MAX_2FA_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failTracker = new Map<string, { fails: number; lockedUntil: number }>();

// Resolve o tenant (por slug ou default) e garante que está ativo (RF03 / TENANT_SUSPENDED).
async function resolveActiveTenant(slug?: string): Promise<string> {
  const shop = slug
    ? await prisma.barbershop.findUnique({ where: { slug } })
    : await prisma.barbershop.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
  if (!shop.isActive) {
    throw new BusinessError('TENANT_SUSPENDED', 'Esta barbearia encontra-se temporariamente indisponível na plataforma.', 403);
  }
  return shop.id;
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!googleOAuthEnabled) {
    throw new BusinessError('OAUTH_DISABLED', 'Login com Google não está configurado neste ambiente.', 503);
  }
  if (!googleClient) {
    googleClient = new OAuth2Client({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri: config.GOOGLE_REDIRECT_URI,
    });
  }
  return googleClient;
}

export async function register(data: {
  name: string;
  identifier: string;
  password: string;
  tenantSlug?: string;
}) {
  // FEAT-078: identifier é e-mail OU telefone.
  const { email, phone } = classifyIdentifier(data.identifier);
  const tenantId = await resolveActiveTenant(data.tenantSlug);

  const existing = await prisma.user.findFirst({
    where: { tenantId, ...(email ? { email: { equals: email, mode: 'insensitive' } } : { phone }) },
  });
  if (existing) {
    throw email
      ? new BusinessError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está cadastrado.', 409)
      : new BusinessError('PHONE_ALREADY_EXISTS', 'Este telefone já está cadastrado.', 409);
  }

  const hash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: email ?? null,
      phone: phone ?? null,
      password: hash,
      role: 'CLIENT',
      tenantId,
    },
  });

  return sessionFor(user);
}

type LoginUser = { id: string; name: string; email: string | null; phone: string | null; role: string; tenantId: string | null; is2faEnabled: boolean };

// FA01: se 2FA ligado, não entrega o JWT — retorna token intermediário de pré-autenticação.
function loginResult(user: LoginUser) {
  if (user.is2faEnabled) {
    return {
      status: 'REQUIRE_2FA' as const,
      message: 'Credenciais válidas. Autenticação de dois fatores necessária.',
      preAuthToken: preAuthTokenFor(user.id),
    };
  }
  return sessionFor(user);
}

function preAuthTokenFor(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: 'razorfy', sub: userId, type: 'PRE_AUTH', iat: now, exp: now + PRE_AUTH_TTL_SECONDS },
    config.JWT_SECRET,
    { algorithm: 'HS256', noTimestamp: true },
  );
}

export async function login(identifier: string, password: string, tenantSlug?: string) {
  // FEAT-078: identifier é e-mail OU telefone.
  const { email, phone } = classifyIdentifier(identifier);

  // DEV (plataforma) é tenant-agnóstico e sempre por e-mail.
  if (email) {
    const dev = await prisma.user.findFirst({
      where: { role: 'DEV', email: { equals: email, mode: 'insensitive' } },
    });
    if (dev) {
      if (!dev.password) throw new BusinessError('INVALID_CREDENTIALS', 'Credenciais inválidas.', 401);
      const ok = await bcrypt.compare(password, dev.password);
      if (!ok) throw new BusinessError('INVALID_CREDENTIALS', 'Credenciais inválidas.', 401);
      return loginResult(dev);
    }
  }

  const tenantId = await resolveActiveTenant(tenantSlug);
  const user = await prisma.user.findFirst({
    where: { tenantId, ...(email ? { email: { equals: email, mode: 'insensitive' } } : { phone }) },
  });
  if (!user) throw new BusinessError('INVALID_CREDENTIALS', 'Credenciais inválidas.', 401);

  // Conta criada apenas via Google não possui senha local.
  if (!user.password) {
    throw new BusinessError('USE_GOOGLE_LOGIN', 'Esta conta usa login com Google. Entre com o Google.', 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new BusinessError('INVALID_CREDENTIALS', 'Credenciais inválidas.', 401);

  return loginResult(user);
}

// V02: valida o preAuthToken (claim type=PRE_AUTH) e retorna o userId; rejeita token comum/expirado.
export function consumePreAuthToken(token: string): string {
  let payload: { sub?: string; type?: string };
  try {
    payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as typeof payload;
  } catch {
    throw new BusinessError('PRE_AUTH_EXPIRED', 'Sessão de verificação expirada. Faça login novamente.', 401);
  }
  if (payload.type !== 'PRE_AUTH' || !payload.sub) {
    throw new BusinessError('PRE_AUTH_INVALID', 'Token de verificação inválido.', 401);
  }
  return payload.sub;
}

// FA01 passo 7: valida o código TOTP e libera o JWT final. Rate-limited (NFR).
export async function verifyLogin2fa(userId: string, code: string) {
  const tracker = failTracker.get(userId);
  if (tracker && tracker.lockedUntil > Date.now()) {
    throw new BusinessError('TOO_MANY_ATTEMPTS', 'Muitas tentativas incorretas. Tente novamente em alguns minutos.', 429);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.is2faEnabled || !user.totpSecret) {
    throw new BusinessError('PRE_AUTH_INVALID', 'Token de verificação inválido.', 401);
  }

  if (!verifyCode(code, decryptSecret(user.totpSecret))) {
    const fails = (tracker?.fails ?? 0) + 1;
    failTracker.set(userId, { fails, lockedUntil: fails >= MAX_2FA_FAILS ? Date.now() + LOCK_MS : 0 });
    throw new BusinessError('INVALID_TOTP_CODE', 'Código inválido. Verifique o app autenticador.', 401);
  }

  failTracker.delete(userId);
  return sessionFor(user);
}

// Monta a URL de autorização do Google (Authorization Code). O state (CSRF) é gerado
// pelo cliente, ecoado aqui e revalidado no callback antes da troca do code.
export function googleAuthUrl(state: string): string {
  return getGoogleClient().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
}

// Troca o authorization code do Google por tokens, valida o ID token e abre sessão.
// Estratégia de conta: vincula por googleId; senão por e-mail verificado (preservando o
// papel existente — BARBER/ADMIN continuam staff); senão cria novo CLIENT.
export async function loginWithGoogle(code: string) {
  const client = getGoogleClient();

  let idToken: string | undefined;
  try {
    const { tokens } = await client.getToken(code);
    idToken = tokens.id_token ?? undefined;
  } catch {
    throw new BusinessError('GOOGLE_CODE_INVALID', 'Código de autorização do Google inválido ou expirado.', 401);
  }
  if (!idToken) {
    throw new BusinessError('GOOGLE_ID_TOKEN_MISSING', 'Google não retornou identidade. Tente novamente.', 401);
  }

  const ticket = await client.verifyIdToken({ idToken, audience: config.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new BusinessError('GOOGLE_IDENTITY_INVALID', 'Não foi possível ler a identidade do Google.', 401);
  }
  if (payload.email_verified === false) {
    throw new BusinessError('GOOGLE_EMAIL_UNVERIFIED', 'E-mail do Google não verificado.', 401);
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name?.trim() || payload.email.split('@')[0];

  // Fase 1: login social resolve para o tenant default.
  const tenantId = await resolveActiveTenant();
  const user = await prisma.$transaction(async tx => {
    const byGoogle = await tx.user.findFirst({ where: { tenantId, googleId } });
    if (byGoogle) return byGoogle;

    const byEmail = await tx.user.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
    });
    if (byEmail) {
      // Vincula a identidade Google à conta existente, preservando o papel atual.
      return tx.user.update({ where: { id: byEmail.id }, data: { googleId } });
    }

    return tx.user.create({
      data: { name, email, googleId, role: 'CLIENT', tenantId },
    });
  });

  return sessionFor(user);
}

// Contrato consumido por frontend e mobile: { accessToken, user: { id, name, email, phone, role } }
// phone pode ser null em contas criadas via Google (provedor não fornece telefone).
function sessionFor(user: { id: string; name: string; email: string | null; phone: string | null; role: string; tenantId: string | null }) {
  return {
    accessToken: tokenFor(user),
    user: { id: user.id, name: user.name, email: user.email ?? null, phone: user.phone ?? null, role: user.role, tenantId: user.tenantId },
  };
}

// Reuso por outros fluxos de autenticação (ex.: OTP por telefone — FEAT-077).
export function buildSession(user: { id: string; name: string; email: string | null; phone: string | null; role: string; tenantId: string | null }) {
  return sessionFor(user);
}

function tokenFor(user: { id: string; name: string; role: string; tenantId: string | null }) {
  const isStaff = STAFF_ROLES.includes(user.role as UserRole);
  const expirationHours = isStaff
    ? config.JWT_STAFF_EXPIRATION_HOURS
    : config.JWT_CLIENT_EXPIRATION_HOURS;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'razorfy',
    sub: user.id,
    name: user.name,
    roles: [user.role],
    // DEV não carrega tenant (tnt ausente); demais roles sempre têm.
    ...(user.tenantId ? { tnt: user.tenantId } : {}),
    iat: now,
    exp: now + expirationHours * 3600,
  };
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: 'HS256', noTimestamp: true });
}
