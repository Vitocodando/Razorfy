import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../prisma';
import { config, googleOAuthEnabled } from '../config';
import { BusinessError } from '../common/BusinessError';
import { UserRole } from '../user/user.types';

const STAFF_ROLES: UserRole[] = ['BARBER', 'ADMIN', 'DEV'];

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
  email: string;
  phone: string;
  password: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
  });
  if (existing) {
    throw new BusinessError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está cadastrado.', 409);
  }

  const hash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      password: hash,
      role: 'CLIENT',
    },
  });

  return sessionFor(user);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user) throw new BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);

  // Conta criada apenas via Google não possui senha local.
  if (!user.password) {
    throw new BusinessError('USE_GOOGLE_LOGIN', 'Esta conta usa login com Google. Entre com o Google.', 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);

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

  const user = await prisma.$transaction(async tx => {
    const byGoogle = await tx.user.findUnique({ where: { googleId } });
    if (byGoogle) return byGoogle;

    const byEmail = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (byEmail) {
      // Vincula a identidade Google à conta existente, preservando o papel atual.
      return tx.user.update({ where: { id: byEmail.id }, data: { googleId } });
    }

    return tx.user.create({
      data: { name, email, googleId, role: 'CLIENT' },
    });
  });

  return sessionFor(user);
}

// Contrato consumido por frontend e mobile: { accessToken, user: { id, name, email, phone, role } }
// phone pode ser null em contas criadas via Google (provedor não fornece telefone).
function sessionFor(user: { id: string; name: string; email: string; phone: string | null; role: string }) {
  return {
    accessToken: tokenFor(user),
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role },
  };
}

function tokenFor(user: { id: string; name: string; role: string }) {
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
    iat: now,
    exp: now + expirationHours * 3600,
  };
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: 'HS256', noTimestamp: true });
}
