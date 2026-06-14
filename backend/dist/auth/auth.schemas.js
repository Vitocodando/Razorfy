"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(100),
    email: zod_1.z.string().email().max(150),
    phone: zod_1.z.string().min(10).max(20),
    password: zod_1.z.string().min(6).max(100),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.GoogleAuthSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
});
