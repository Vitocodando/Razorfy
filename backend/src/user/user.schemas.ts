import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{1,14}$/).max(20).optional(),
  notificationPushEnabled: z.boolean().optional(),
  notificationWhatsappEnabled: z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const DeleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
});
