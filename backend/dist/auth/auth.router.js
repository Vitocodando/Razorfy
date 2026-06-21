"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_schemas_1 = require("./auth.schemas");
const auth_service_1 = require("./auth.service");
const asyncHandler_1 = require("../common/asyncHandler");
const BusinessError_1 = require("../common/BusinessError");
const config_1 = require("../config");
const zod_1 = require("zod");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/register', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.RegisterSchema.parse(req.body);
    const result = await (0, auth_service_1.register)(data);
    res.status(201).json(result);
}));
exports.authRouter.post('/login', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, tenantSlug } = auth_schemas_1.LoginSchema.parse(req.body);
    const result = await (0, auth_service_1.login)(email, password, tenantSlug);
    // FA01: 2FA exigido → 202 Accepted com preAuthToken; senão 200 com a sessão.
    if ('status' in result && result.status === 'REQUIRE_2FA') {
        res.status(202).json(result);
        return;
    }
    res.json(result);
}));
// FA01 passo 6/7: troca preAuthToken + código TOTP pelo JWT final.
exports.authRouter.post('/login/verify-2fa', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        throw new BusinessError_1.BusinessError('PRE_AUTH_INVALID', 'Token de verificação não fornecido.', 401);
    }
    const userId = (0, auth_service_1.consumePreAuthToken)(header.slice(7));
    const { code } = auth_schemas_1.Verify2faSchema.parse(req.body);
    res.json(await (0, auth_service_1.verifyLogin2fa)(userId, code));
}));
// Indica ao cliente se o login social está disponível neste ambiente.
exports.authRouter.get('/google/status', (_req, res) => {
    res.json({ enabled: config_1.googleOAuthEnabled });
});
// Retorna a URL de autorização do Google para o redirect inicial.
exports.authRouter.get('/google/url', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!config_1.googleOAuthEnabled) {
        throw new BusinessError_1.BusinessError('OAUTH_DISABLED', 'Login com Google não está configurado neste ambiente.', 503);
    }
    const state = zod_1.z.string().min(1).parse(req.query.state);
    res.json({ url: (0, auth_service_1.googleAuthUrl)(state) });
}));
// Troca o authorization code por uma sessão Razorfy.
exports.authRouter.post('/google', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { code } = auth_schemas_1.GoogleAuthSchema.parse(req.body);
    const result = await (0, auth_service_1.loginWithGoogle)(code);
    res.json(result);
}));
