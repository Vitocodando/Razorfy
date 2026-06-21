import { prisma } from '../prisma';

export const DEFAULT_TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

export async function findActiveServices(tenantId: string = DEFAULT_TENANT_ID) {
  return prisma.service.findMany({
    where: { tenantId, active: true },
    orderBy: { name: 'asc' },
  });
}

export async function findBarbers(tenantId: string = DEFAULT_TENANT_ID) {
  return prisma.user.findMany({
    where: { tenantId, role: 'BARBER', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
