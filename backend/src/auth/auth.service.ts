import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { config } from '../config';
import { BusinessError } from '../common/BusinessError';
import { UserRole } from '../user/user.types';

const STAFF_ROLES: UserRole[] = ['BARBER', 'ADMIN', 'DEV'];

export async function register(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
  });
  if (existing) {
    throw new BusinessError('EMAIL_ALREADY_EXISTS', 'Este e-mail já está cadastrado.', 409);
  }

  const hash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      password: hash,
      role: 'CLIENT',
    },
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role, token: tokenFor(user) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user) throw new BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new BusinessError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);

  return { id: user.id, name: user.name, email: user.email, role: user.role, token: tokenFor(user) };
}

function tokenFor(user: { id: string; name: string; role: string }) {
  const isStaff = STAFF_ROLES.includes(user.role as UserRole);
  const expirationHours = isStaff
    ? config.JWT_STAFF_EXPIRATION_HOURS
    : config.JWT_CLIENT_EXPIRATION_HOURS;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'razorfy',
    sub: user.id,
    name: user.name,
    roles: [user.role],
    iat: now,
    exp: now + expirationHours * 3600,
  };
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: 'HS256', noTimestamp: true });
}
