"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../middleware/authenticate");
const asyncHandler_1 = require("../common/asyncHandler");
const user_schemas_1 = require("./user.schemas");
const user_service_1 = require("./user.service");
exports.userRouter = (0, express_1.Router)();
exports.userRouter.use(authenticate_1.authenticate);
exports.userRouter.get('/me', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, user_service_1.getMe)(req.user.id));
}));
// RF01: atualiza perfil/preferências do usuário autenticado (id do JWT).
exports.userRouter.patch('/me', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = user_schemas_1.UpdateProfileSchema.parse(req.body);
    res.json(await (0, user_service_1.updateProfile)(req.user.id, data));
}));
// RF02: troca de senha.
exports.userRouter.put('/me/password', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = user_schemas_1.ChangePasswordSchema.parse(req.body);
    await (0, user_service_1.changePassword)(req.user.id, currentPassword, newPassword);
    res.status(204).end();
}));
// RF03: exclusão (anonimização LGPD) do próprio cliente.
exports.userRouter.delete('/me', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { currentPassword } = user_schemas_1.DeleteAccountSchema.parse(req.body);
    await (0, user_service_1.anonymizeAccount)(req.user.id, currentPassword);
    res.status(204).end();
}));
