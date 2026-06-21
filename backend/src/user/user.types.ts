export type UserRole = 'CLIENT' | 'BARBER' | 'ADMIN' | 'DEV';

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  tenantId: string | null; // null somente para DEV (plataforma)
}
