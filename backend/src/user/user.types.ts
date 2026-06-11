export type UserRole = 'CLIENT' | 'BARBER' | 'ADMIN' | 'DEV';

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
}
