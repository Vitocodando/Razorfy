import { Router } from 'express';
import { z } from 'zod';
import { availableStarts } from './availability.service';
import { asyncHandler } from '../common/asyncHandler';
import { BusinessError } from '../common/BusinessError';
import { authenticate } from '../middleware/authenticate';
import { prisma } from '../prisma';

export const scheduleRouter = Router();

scheduleRouter.get('/barbers/:id/availability', asyncHandler(async (req, res) => {
  const barberId = req.params.id;
  const { date, duration } = req.query;
  if (!date || typeof date !== 'string') {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro date é obrigatório (YYYY-MM-DD).', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro date deve estar no formato YYYY-MM-DD.', 400);
  }
  const durationMinutes = duration ? parseInt(String(duration), 10) : 0;
  if (!durationMinutes || isNaN(durationMinutes)) {
    throw new BusinessError('INVALID_INPUT', 'O parâmetro duration é obrigatório e deve ser um inteiro positivo.', 400);
  }
  const slots = await availableStarts(barberId, date, durationMinutes);
  res.json({ availableStarts: slots.map(d => d.toISOString()) });
}));

// ---------- Helpers de conversão TIME ↔ string ----------

function timeStrToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

function dateToTimeStr(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// ---------- Schemas de validação ----------

const SlotInputSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  lunchStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

const SlotsBodySchema = z.array(SlotInputSchema);

function assertSlotAccess(userRole: string, userId: string, targetId: string) {
  if (userRole === 'CLIENT') throw new BusinessError('FORBIDDEN', 'Acesso negado.', 403);
  if (userRole === 'BARBER' && userId !== targetId) throw new BusinessError('FORBIDDEN', 'Acesso negado.', 403);
}

// GET /barbers/:id/slots
scheduleRouter.get('/barbers/:id/slots', authenticate, asyncHandler(async (req, res) => {
  const user = req.user!;
  assertSlotAccess(user.role, user.id, req.params.id);

  const slots = await prisma.barberSlot.findMany({
    where: { barberId: req.params.id },
    orderBy: { dayOfWeek: 'asc' },
  });
  res.json(slots.map(s => ({
    dayOfWeek: s.dayOfWeek,
    startTime: dateToTimeStr(s.startTime),
    endTime: dateToTimeStr(s.endTime),
    lunchStart: s.lunchStart ? dateToTimeStr(s.lunchStart) : null,
    lunchEnd: s.lunchEnd ? dateToTimeStr(s.lunchEnd) : null,
  })));
}));

// PUT /barbers/:id/slots
scheduleRouter.put('/barbers/:id/slots', authenticate, asyncHandler(async (req, res) => {
  const user = req.user!;
  assertSlotAccess(user.role, user.id, req.params.id);

  const body = SlotsBodySchema.parse(req.body);

  for (const s of body) {
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const startMin = toMin(s.startTime);
    const endMin = toMin(s.endTime);
    if (startMin >= endMin) {
      throw new BusinessError('INVALID_SLOT', `Dia ${s.dayOfWeek}: horário de início deve ser antes do fim.`, 422);
    }
    if ((s.lunchStart && !s.lunchEnd) || (!s.lunchStart && s.lunchEnd)) {
      throw new BusinessError('INVALID_SLOT', `Dia ${s.dayOfWeek}: lunchStart e lunchEnd devem ser informados juntos.`, 422);
    }
    if (s.lunchStart && s.lunchEnd) {
      const lsMin = toMin(s.lunchStart);
      const leMin = toMin(s.lunchEnd);
      if (lsMin >= leMin) throw new BusinessError('INVALID_SLOT', `Dia ${s.dayOfWeek}: início do almoço deve ser antes do fim.`, 422);
      if (lsMin < startMin || leMin > endMin) throw new BusinessError('INVALID_SLOT', `Dia ${s.dayOfWeek}: intervalo de almoço deve estar dentro do expediente.`, 422);
    }
  }

  const barber = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!barber || barber.role !== 'BARBER') {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }

  const incomingDays = body.map(s => s.dayOfWeek);
  await prisma.$transaction([
    prisma.barberSlot.deleteMany({ where: { barberId: req.params.id, dayOfWeek: { notIn: incomingDays } } }),
    ...body.map(s => prisma.barberSlot.upsert({
      where: { barberId_dayOfWeek: { barberId: req.params.id, dayOfWeek: s.dayOfWeek } },
      update: {
        startTime: timeStrToDate(s.startTime),
        endTime: timeStrToDate(s.endTime),
        lunchStart: s.lunchStart ? timeStrToDate(s.lunchStart) : null,
        lunchEnd: s.lunchEnd ? timeStrToDate(s.lunchEnd) : null,
      },
      create: {
        barberId: req.params.id,
        dayOfWeek: s.dayOfWeek,
        startTime: timeStrToDate(s.startTime),
        endTime: timeStrToDate(s.endTime),
        lunchStart: s.lunchStart ? timeStrToDate(s.lunchStart) : null,
        lunchEnd: s.lunchEnd ? timeStrToDate(s.lunchEnd) : null,
      },
    })),
  ]);

  res.json({ ok: true });
}));
