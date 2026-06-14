"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.googleAuthUrl = googleAuthUrl;
exports.loginWithGoogle = loginWithGoogle;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = require("../prisma");
const config_1 = require("../config");
const BusinessError_1 = require("../common/BusinessError");
const STAFF_ROLES = ['BARBER', 'ADMIN', 'DEV'];
let googleClient = null;
function getGoogleClient() {
    if (!config_1.googleOAuthEnabled) {
        throw new BusinessError_1.BusinessError('OAUTH_DISABLED', 'Login com Google não está configurado neste ambiente.', 503);
    }
    if (!googleClient) {
        googleClient = new google_auth_library_1.OAuth2Client({
            clientId: config_1.config.GOOGLE_CLIENT_ID,
            clientSecret: config_1.config.GOOGLE_CLIENT_SECRET,
            redirectUri: config_1.config.GOOGLE_REDIRECT_URI,
        });
    }
    return googleClient;
}
async function register(data) {
    const existing = await prisma_1.prisma.user.findFirst({
        where: { email: { equals: data.email, mode: 'insensitive' } },
    });
    if (existing) {
        throw new BusinessError_1.BusinessError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está cadastrado.', 409);
    }
    const hash = await bcrypt_1.default.hash(data.password, 12);
    const user = await prisma_1.prisma.user.create({
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
async function login(email, password) {
    const user = await prisma_1.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user)
        throw new BusinessError_1.BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);
    // Conta criada apenas via Google não possui senha local.
    if (!user.password) {
        throw new BusinessError_1.BusinessError('USE_GOOGLE_LOGIN', 'Esta conta usa login com Google. Entre com o Google.', 401);
    }
    const valid = await bcrypt_1.default.compare(password, user.password);
    if (!valid)
        throw new BusinessError_1.BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);
    return sessionFor(user);
}
// Monta a URL de autorização do Google (Authorization Code). O state (CSRF) é gerado
// pelo cliente, ecoado aqui e revalidado no callback antes da troca do code.
function googleAuthUrl(state) {
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
async function loginWithGoogle(code) {
    const client = getGoogleClient();
    let idToken;
    try {
        const { tokens } = await client.getToken(code);
        idToken = tokens.id_token ?? undefined;
    }
    catch {
        throw new BusinessError_1.BusinessError('GOOGLE_CODE_INVALID', 'Código de autorização do Google inválido ou expirado.', 401);
    }
    if (!idToken) {
        throw new BusinessError_1.BusinessError('GOOGLE_ID_TOKEN_MISSING', 'Google não retornou identidade. Tente novamente.', 401);
    }
    const ticket = await client.verifyIdToken({ idToken, audience: config_1.config.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
        throw new BusinessError_1.BusinessError('GOOGLE_IDENTITY_INVALID', 'Não foi possível ler a identidade do Google.', 401);
    }
    if (payload.email_verified === false) {
        throw new BusinessError_1.BusinessError('GOOGLE_EMAIL_UNVERIFIED', 'E-mail do Google não verificado.', 401);
    }
    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name?.trim() || payload.email.split('@')[0];
    const user = await prisma_1.prisma.$transaction(async (tx) => {
        const byGoogle = await tx.user.findUnique({ where: { googleId } });
        if (byGoogle)
            return byGoogle;
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
function sessionFor(user) {
    return {
        accessToken: tokenFor(user),
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role },
    };
}
function tokenFor(user) {
    const isStaff = STAFF_ROLES.includes(user.role);
    const expirationHours = isStaff
        ? config_1.config.JWT_STAFF_EXPIRATION_HOURS
        : config_1.config.JWT_CLIENT_EXPIRATION_HOURS;
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: 'razorfy',
        sub: user.id,
        name: user.name,
        roles: [user.role],
        iat: now,
        exp: now + expirationHours * 3600,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, { algorithm: 'HS256', noTimestamp: true });
}
