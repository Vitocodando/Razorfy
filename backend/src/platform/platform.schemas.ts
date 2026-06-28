import { z } from 'zod';

export const ListTenantsQuery = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateTenantSchema = z.object({
  tenant: z.object({
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().toLowerCase().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífen.'),
    connectionCode: z.string().trim().toUpperCase().min(3).max(10).regex(/^[A-Z0-9]+$/, 'Código deve conter apenas letras e números.'),
  }),
  adminUser: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(150),
    phone: z.string().trim().min(8).max(20),
    initialPassword: z.string().min(8).max(72),
  }),
});

export const TenantStatusSchema = z.object({
  isActive: z.boolean(),
});

// FEAT-084: gestão global de usuários.
export const PageQuery = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const SearchUsersQuery = z.object({
  q: z.string().trim().min(2).max(100),
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(150).optional().or(z.literal('')),
  role: z.string().min(1).max(20),
  isActive: z.boolean(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
