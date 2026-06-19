import { prisma } from '../prisma';

export async function findActiveServices() {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
}

export async function findBarbers() {
  return prisma.user.findMany({
    where: { role: 'BARBER', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
