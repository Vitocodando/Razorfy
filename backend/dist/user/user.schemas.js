"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteAccountSchema = exports.ChangePasswordSchema = exports.UpdateProfileSchema = void 0;
const zod_1 = require("zod");
exports.UpdateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(3).max(100).optional(),
    phone: zod_1.z.string().trim().regex(/^\+?[1-9]\d{1,14}$/).max(20).optional(),
    notificationPushEnabled: zod_1.z.boolean().optional(),
    notificationWhatsappEnabled: zod_1.z.boolean().optional(),
});
exports.ChangePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6).max(100),
});
exports.DeleteAccountSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
});
