import bcrypt from 'bcrypt';
import { config } from '../config';
import { prisma } from '../prisma';

export async function devBootstrap() {
  if (!config.DEV_BOOTSTRAP_ENABLED) return;

  const { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, DEV_STAFF_PASSWORD } = config;

  if (DEV_ADMIN_EMAIL && DEV_ADMIN_PASSWORD) {
    const exists = await prisma.user.findFirst({
      where: { email: { equals: DEV_ADMIN_EMAIL, mode: 'insensitive' } },
    });
    if (!exists) {
      const hash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);
      await prisma.user.create({
        data: {
          name: 'Administrador Razorfy',
          email: DEV_ADMIN_EMAIL.toLowerCase(),
          phone: '+5511999990099',
          password: hash,
          role: 'ADMIN',
        },
      });
      console.log(`[bootstrap] admin criado: ${DEV_ADMIN_EMAIL}`);
    }
  }

  if (DEV_STAFF_PASSWORD) {
    const hash = await bcrypt.hash(DEV_STAFF_PASSWORD, 12);
    const barbers = await prisma.user.findMany({ where: { role: 'BARBER' } });
    for (const barber of barbers) {
      await prisma.user.update({ where: { id: barber.id }, data: { password: hash } });
    }
    if (barbers.length > 0) {
      console.log(`[bootstrap] senha de ${barbers.length} barbeiro(s) atualizada`);
    }
  }
}
