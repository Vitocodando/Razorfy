import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { dateOnlyUtc, localDateString, localDayRangeUtc } from '../schedule/availability.service';
import * as cashbackSvc from '../cashback/cashback.service';
import * as auditSvc from '../audit/audit.service';
import * as notifSvc from '../notification/notification.service';
import { config } from '../config';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type CouponInput = {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_VALUE';
  discountValue: number;
  maxUsesGlobal?: number | null;
  expiresAt: string;
};

type CommissionInput = {
  barberId: string;
  serviceId: string;
  commissionPct: number;
};

type VacationInput = {
  barberId: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

const NO_SHOW_TOLERANCE_MINUTES = 15;

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCoupon(data: CouponInput) {
  return prisma.coupon.create({
    data: {
      code: data.code,
      discountType: data.discountType,
      discountValue: new Prisma.Decimal(data.discountValue),
      maxUsesGlobal: data.maxUsesGlobal ?? null,
      expiresAt: new Date(data.expiresAt),
    },
  });
}

export async function updateCoupon(id: string, data: CouponInput) {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw new BusinessError('COUPON_NOT_FOUND', 'Cupom não encontrado.', 404);
  if (data.maxUsesGlobal !== null && data.maxUsesGlobal !== undefined && data.maxUsesGlobal < current.currentUses) {
    throw new BusinessError('COUPON_LIMIT_REACHED', 'O limite informado é menor que o número de usos atuais.', 422);
  }
  return prisma.coupon.update({
    where: { id },
    data: {
      code: data.code,
      discountType: data.discountType,
      discountValue: new Prisma.Decimal(data.discountValue),
      maxUsesGlobal: data.maxUsesGlobal ?? null,
      expiresAt: new Date(data.expiresAt),
    },
  });
}

export async function deleteCoupon(id: string) {
  await prisma.coupon.delete({ where: { id } });
}

export async function listCommissions() {
  return prisma.barberCommission.findMany({
    include: {
      barber: { select: { id: true, name: true } },
      service: { select: { id: true, name: true, price: true } },
    },
    orderBy: [{ barber: { name: 'asc' } }, { service: { name: 'asc' } }],
  });
}

export async function upsertCommission(adminId: string, data: CommissionInput) {
  return prisma.$transaction(async tx => {
    await assertBarberAndService(tx, data.barberId, data.serviceId);

    const previous = await tx.barberCommission.findUnique({
      where: { barberId_serviceId: { barberId: data.barberId, serviceId: data.serviceId } },
    });

    const commission = await tx.barberCommission.upsert({
      where: { barberId_serviceId: { barberId: data.barberId, serviceId: data.serviceId } },
      update: { commissionPct: new Prisma.Decimal(data.commissionPct) },
      create: {
        barberId: data.barberId,
        serviceId: data.serviceId,
        commissionPct: new Prisma.Decimal(data.commissionPct),
      },
    });

    adminAuditLog(adminId, 'UPSERT_BARBER_COMMISSION', previous, commission);
    return commission;
  });
}

export async function deleteCommission(adminId: string, id: string) {
  const previous = await prisma.barberCommission.findUnique({ where: { id } });
  if (!previous) throw new BusinessError('COMMISSION_NOT_FOUND', 'Regra de comissão não encontrada.', 404);
  await prisma.barberCommission.delete({ where: { id } });
  adminAuditLog(adminId, 'DELETE_BARBER_COMMISSION', previous, null);
}

export async function getCommissionSettlement(from?: string, to?: string) {
  const today = localDateString();
  const rangeFrom = from ?? today;
  const rangeTo = to ?? rangeFrom;
  if (rangeTo < rangeFrom) {
    throw new BusinessError('INVALID_DATE_RANGE', 'A data final deve ser maior ou igual à inicial.', 400);
  }

  const { dayStartUtc } = localDayRangeUtc(rangeFrom);
  const { dayEndUtc } = localDayRangeUtc(rangeTo);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'CONCLUDED',
      startTimestamp: { gte: dayStartUtc, lt: dayEndUtc },
    },
    include: {
      barber: { select: { id: true, name: true } },
      services: true,
    },
    orderBy: { startTimestamp: 'asc' },
  });

  const commissions = await prisma.barberCommission.findMany();
  const commissionByKey = new Map(commissions.map(c => [`${c.barberId}:${c.serviceId}`, c.commissionPct]));
  const byBarber = new Map<string, {
    barberId: string;
    barberName: string;
    netRevenue: Prisma.Decimal;
    commissionTotal: Prisma.Decimal;
    services: Array<{
      appointmentId: string;
      serviceId: string;
      serviceName: string;
      netAmount: Prisma.Decimal;
      commissionPct: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>;
  }>();

  for (const appt of appointments) {
    const ratio = appt.totalPrice.greaterThan(0)
      ? appt.amountPaid.div(appt.totalPrice)
      : new Prisma.Decimal(0);
    const row = byBarber.get(appt.barberId) ?? {
      barberId: appt.barberId,
      barberName: appt.barber.name,
      netRevenue: new Prisma.Decimal(0),
      commissionTotal: new Prisma.Decimal(0),
      services: [],
    };

    for (const service of appt.services) {
      const netAmount = service.price.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const commissionPct = commissionByKey.get(`${appt.barberId}:${service.serviceId}`) ?? new Prisma.Decimal(0);
      const commissionAmount = netAmount.mul(commissionPct).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      row.netRevenue = row.netRevenue.plus(netAmount);
      row.commissionTotal = row.commissionTotal.plus(commissionAmount);
      row.services.push({
        appointmentId: appt.id,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        netAmount,
        commissionPct,
        commissionAmount,
      });
    }
    byBarber.set(appt.barberId, row);
  }

  const barbers = [...byBarber.values()].map(row => ({
    ...row,
    netRevenue: row.netRevenue.toDecimalPlaces(2),
    commissionTotal: row.commissionTotal.toDecimalPlaces(2),
  }));

  return {
    from: rangeFrom,
    to: rangeTo,
    barbers,
    totals: {
      netRevenue: barbers.reduce((acc, b) => acc.plus(b.netRevenue), new Prisma.Decimal(0)).toDecimalPlaces(2),
      commissionTotal: barbers.reduce((acc, b) => acc.plus(b.commissionTotal), new Prisma.Decimal(0)).toDecimalPlaces(2),
    },
  };
}

export async function applyNoShow(adminId: string, appointmentId: string, reason?: string) {
  return prisma.$transaction(async tx => {
    const appt = await lockAppointmentForAdmin(tx, appointmentId);
    const previousStatus = appt.status;

    if (appt.status !== 'CONFIRMED') {
      throw new BusinessError('INVALID_APPOINTMENT_STATE', 'Apenas agendamentos confirmados podem receber No-Show.', 422);
    }

    const dueAt = new Date(appt.startTimestamp.getTime() + NO_SHOW_TOLERANCE_MINUTES * 60 * 1000);
    if (new Date() <= dueAt) {
      throw new BusinessError(
        'APPOINTMENT_NOT_YET_DUE',
        'O agendamento ainda não ultrapassou o período de tolerância de 15 minutos para ser classificado como No-Show.',
        422,
      );
    }

    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    const previousWalletBalance = wallet.balance;
    const penalty = await cashbackSvc.penalizeNoShow(tx, wallet, appt.id);

    await tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'NO_SHOW' },
    });

    await auditSvc.statusChanged(tx, appt.id, previousStatus, 'NO_SHOW', adminId, {
      source: 'ADMIN_NO_SHOW',
      reason: reason ?? null,
      deductedAmount: penalty.deductedAmount.toFixed(2),
    });

    await notifSvc.noShowPenalty(tx, appointmentData(appt, 'NO_SHOW'), penalty.deductedAmount.toFixed(2));

    adminAuditLog(adminId, 'APPLY_NO_SHOW', { appointmentId: appt.id, status: previousStatus, walletBalance: previousWalletBalance }, {
      appointmentId: appt.id,
      status: 'NO_SHOW',
      deductedAmount: penalty.deductedAmount.toFixed(2),
    });

    return {
      appointmentId: appt.id,
      previousStatus,
      newStatus: 'NO_SHOW',
      punishmentApplied: true,
      clientWalletDetails: {
        clientId: appt.clientId,
        deductedAmount: penalty.deductedAmount,
        newBalance: new Prisma.Decimal(0),
        transactionId: penalty.transactionId,
      },
    };
  });
}

export async function listVacationBlocks() {
  return prisma.vacationBlock.findMany({
    include: { barber: { select: { id: true, name: true } } },
    orderBy: [{ startDate: 'asc' }, { barber: { name: 'asc' } }],
  });
}

export async function createVacationBlock(adminId: string, data: VacationInput) {
  if (data.endDate < data.startDate) {
    throw new BusinessError('INVALID_VACATION_RANGE', 'A data final deve ser maior ou igual à data inicial.', 422);
  }
  if (data.startDate < localDateString()) {
    throw new BusinessError('INVALID_VACATION_RANGE', 'Bloqueios de férias não podem ser retroativos.', 422);
  }

  const startDate = dateOnlyUtc(data.startDate);
  const endDate = dateOnlyUtc(data.endDate);
  const { dayStartUtc } = localDayRangeUtc(data.startDate);
  const { dayEndUtc } = localDayRangeUtc(data.endDate);

  return prisma.$transaction(async tx => {
    const barberRows = await (tx as typeof prisma).$queryRaw<Array<{ id: string; role: string; name: string }>>`
      SELECT id, role, name FROM users WHERE id = ${data.barberId}::uuid FOR UPDATE
    `;
    if (barberRows.length === 0 || barberRows[0].role !== 'BARBER') {
      throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
    }

    const overlap = await tx.vacationBlock.findFirst({
      where: {
        barberId: data.barberId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlap) {
      throw vacationOverlap('O barbeiro já possui férias cadastradas neste período.', []);
    }

    const conflicts = await tx.appointment.findMany({
      where: {
        barberId: data.barberId,
        status: 'CONFIRMED',
        startTimestamp: { lt: dayEndUtc },
        endTimestamp: { gt: dayStartUtc },
      },
      include: { client: { select: { id: true, name: true, phone: true } } },
      orderBy: { startTimestamp: 'asc' },
    });
    if (conflicts.length > 0) {
      throw vacationOverlap(
        'O barbeiro já possui férias ou agendamentos confirmados cadastrados neste período. Remarque os agendamentos primeiro.',
        conflicts.map(c => ({
          appointmentId: c.id,
          clientId: c.client.id,
          clientName: c.client.name,
          clientPhone: c.client.phone,
          startTimestamp: c.startTimestamp,
        })),
      );
    }

    const block = await tx.vacationBlock.create({
      data: { barberId: data.barberId, startDate, endDate },
    });
    adminAuditLog(adminId, 'CREATE_VACATION_BLOCK', null, { ...block, reason: data.reason ?? null });
    return block;
  });
}

export async function deleteVacationBlock(adminId: string, id: string) {
  const previous = await prisma.vacationBlock.findUnique({ where: { id } });
  if (!previous) throw new BusinessError('VACATION_NOT_FOUND', 'Bloqueio de férias não encontrado.', 404);
  await prisma.vacationBlock.delete({ where: { id } });
  adminAuditLog(adminId, 'DELETE_VACATION_BLOCK', previous, null);
}

export async function getGlobalGrid(date = localDateString()) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const dateOnly = dateOnlyUtc(date);
  const [barbers, appointments, vacations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'BARBER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        startTimestamp: { lt: dayEndUtc },
        endTimestamp: { gt: dayStartUtc },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { select: { id: true, name: true } },
        services: true,
      },
      orderBy: [{ startTimestamp: 'asc' }, { barber: { name: 'asc' } }],
    }),
    prisma.vacationBlock.findMany({
      where: {
        startDate: { lte: dateOnly },
        endDate: { gte: dateOnly },
      },
    }),
  ]);

  return {
    date,
    barbers: barbers.map(b => ({
      ...b,
      onVacation: vacations.some(v => v.barberId === b.id),
    })),
    appointments: appointments.map(a => ({
      appointmentId: a.id,
      barberId: a.barberId,
      barberName: a.barber.name,
      clientId: a.clientId,
      clientName: a.client.name,
      clientPhone: a.client.phone,
      status: a.status,
      startTimestamp: a.startTimestamp,
      endTimestamp: a.endTimestamp,
      totalPrice: a.totalPrice,
      amountToPay: a.amountPaid,
      cashbackUsed: a.cashbackUsed,
      couponCode: a.couponCode,
      couponDiscount: a.couponDiscount,
      services: a.services.map(s => ({ name: s.serviceName, durationMinutes: s.durationMinutes, price: s.price })),
    })),
  };
}

export async function refreshDailyReport(date = localDateString()) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const reportDate = dateOnlyUtc(date);
  const [daily, lifetime, heatmap] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startTimestamp: { gte: dayStartUtc, lt: dayEndUtc },
        status: { in: ['CONCLUDED', 'NO_SHOW'] },
      },
      select: { status: true, totalPrice: true, amountPaid: true },
    }),
    prisma.$queryRaw<Array<{ net_revenue: string; clients: bigint }>>`
      SELECT COALESCE(SUM(amount_paid), 0)::text as net_revenue,
             COUNT(DISTINCT client_id) as clients
      FROM appointments
      WHERE status = 'CONCLUDED'
    `,
    occupancyHeatmap(date),
  ]);

  const concluded = daily.filter(a => a.status === 'CONCLUDED');
  const grossRevenue = concluded.reduce((acc, a) => acc.plus(a.totalPrice), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const netRevenue = concluded.reduce((acc, a) => acc.plus(a.amountPaid), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const averageTicket = concluded.length > 0
    ? netRevenue.div(concluded.length).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal(0);
  const lifetimeRow = lifetime[0] ?? { net_revenue: '0', clients: BigInt(0) };
  const estimatedLtv = Number(lifetimeRow.clients) > 0
    ? new Prisma.Decimal(lifetimeRow.net_revenue).div(Number(lifetimeRow.clients)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal(0);
  const workingMinutes = heatmap.reduce((acc, h) => acc + h.workingMinutes, 0);
  const busyMinutes = heatmap.reduce((acc, h) => acc + h.busyMinutes, 0);
  const idleMinutes = Math.max(workingMinutes - busyMinutes, 0);
  const occupancyPct = workingMinutes > 0
    ? new Prisma.Decimal(busyMinutes).mul(100).div(workingMinutes).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal(0);

  return prisma.dailyAdminReport.upsert({
    where: { reportDate },
    update: {
      grossRevenue,
      netRevenue,
      concludedAppointments: concluded.length,
      noShowAppointments: daily.filter(a => a.status === 'NO_SHOW').length,
      averageTicket,
      estimatedLtv,
      idleMinutes,
      occupancyPct,
      heatmap: heatmap as Prisma.InputJsonValue,
    },
    create: {
      reportDate,
      grossRevenue,
      netRevenue,
      concludedAppointments: concluded.length,
      noShowAppointments: daily.filter(a => a.status === 'NO_SHOW').length,
      averageTicket,
      estimatedLtv,
      idleMinutes,
      occupancyPct,
      heatmap: heatmap as Prisma.InputJsonValue,
    },
  });
}

export async function getDashboard(date = localDateString()) {
  const [report, alerts, grid] = await Promise.all([
    refreshDailyReport(date),
    listAdminAlerts('PENDING'),
    getGlobalGrid(date),
  ]);
  return { report, alerts: alerts.slice(0, 5), grid };
}

export async function listAdminAlerts(status?: 'PENDING' | 'RESOLVED') {
  return prisma.adminAlert.findMany({
    where: status ? { status } : undefined,
    include: {
      appointment: {
        include: {
          client: { select: { id: true, name: true, phone: true } },
          barber: { select: { id: true, name: true } },
          services: true,
          review: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveAdminAlert(adminId: string, id: string) {
  const alert = await prisma.adminAlert.findUnique({ where: { id } });
  if (!alert) throw new BusinessError('ALERT_NOT_FOUND', 'Alerta não encontrado.', 404);
  return prisma.adminAlert.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: adminId },
  });
}

export async function runWinBackCampaign(referenceDate = localDateString()) {
  const targetDate = addDays(referenceDate, -45);
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(referenceDate);
  const candidates = await prisma.$queryRaw<Array<{ id: string; name: string; phone: string }>>`
    SELECT u.id, u.name, u.phone
    FROM users u
    JOIN appointments a ON a.client_id = u.id
    WHERE u.role = 'CLIENT'
      AND u.phone IS NOT NULL
      AND a.status = 'CONCLUDED'
    GROUP BY u.id, u.name, u.phone
    HAVING MAX((a.start_timestamp AT TIME ZONE ${config.BUSINESS_TIMEZONE})::date) = ${targetDate}::date
      AND NOT EXISTS (
        SELECT 1 FROM appointments future
        WHERE future.client_id = u.id
          AND future.status = 'CONFIRMED'
          AND future.start_timestamp > now()
      )
  `;

  let published = 0;
  let skipped = 0;
  let failures = 0;
  for (const candidate of candidates) {
    const alreadyQueued = await prisma.notificationOutbox.findFirst({
      where: {
        eventType: 'WIN_BACK',
        destination: candidate.phone,
        createdAt: { gte: dayStartUtc, lt: dayEndUtc },
      },
    });
    if (alreadyQueued) {
      skipped++;
      continue;
    }
    try {
      await prisma.$transaction(tx => notifSvc.winBack(tx, {
        clientId: candidate.id,
        clientName: candidate.name,
        clientPhone: candidate.phone,
        lastAppointmentDate: targetDate,
      }));
      published++;
    } catch (err) {
      failures++;
      console.warn('[winback] falha ao enfileirar campanha:', err);
    }
  }

  const metrics = { job: 'win-back', referenceDate, targetDate, candidates: candidates.length, published, skipped, failures };
  console.log(JSON.stringify({ event: 'winback_metrics', timestamp: new Date().toISOString(), ...metrics }));
  return metrics;
}

async function assertBarberAndService(tx: TxClient, barberId: string, serviceId: string) {
  const [barber, service] = await Promise.all([
    tx.user.findUnique({ where: { id: barberId }, select: { role: true } }),
    tx.service.findUnique({ where: { id: serviceId }, select: { id: true } }),
  ]);
  if (!barber || barber.role !== 'BARBER') {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }
  if (!service) {
    throw new BusinessError('SERVICE_NOT_FOUND', 'Serviço não encontrado.', 404);
  }
}

async function lockAppointmentForAdmin(tx: TxClient, id: string) {
  const rows = await (tx as typeof prisma).$queryRaw<Array<{ id: string }>>`
    SELECT id FROM appointments WHERE id = ${id}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  return tx.appointment.findUniqueOrThrow({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      barber: { select: { id: true, name: true } },
    },
  });
}

function appointmentData(appt: Awaited<ReturnType<typeof lockAppointmentForAdmin>>, status: string) {
  return {
    id: appt.id,
    clientId: appt.client.id,
    clientName: appt.client.name,
    clientPhone: appt.client.phone,
    barberName: appt.barber.name,
    startTimestamp: appt.startTimestamp,
    status,
  };
}

function vacationOverlap(message: string, conflicts: Array<Record<string, unknown>>) {
  return new BusinessError('VACATION_OVERLAP', message, 409, { conflicts });
}

function adminAuditLog(adminId: string, action: string, previousPayload: unknown, newPayload: unknown) {
  console.log(JSON.stringify({
    event: 'admin_audit',
    admin_id: adminId,
    timestamp: new Date().toISOString(),
    action,
    payload_anterior: previousPayload,
    payload_novo: newPayload,
  }));
}

async function occupancyHeatmap(date: string) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const dayOfWeek = isoWeekday(date);
  const [barbers, appointments] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'BARBER' },
      select: {
        id: true,
        name: true,
        barberSlots: { where: { dayOfWeek } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CONCLUDED'] },
        startTimestamp: { lt: dayEndUtc },
        endTimestamp: { gt: dayStartUtc },
      },
      select: { barberId: true, startTimestamp: true, endTimestamp: true },
    }),
  ]);

  return barbers.map(barber => {
    const slot = barber.barberSlots[0];
    const workingMinutes = slot ? slotMinutes(slot) : 0;
    const busyMinutes = appointments
      .filter(a => a.barberId === barber.id)
      .reduce((acc, a) => acc + overlapMinutes(a.startTimestamp, a.endTimestamp, dayStartUtc, dayEndUtc), 0);
    const idleMinutes = Math.max(workingMinutes - busyMinutes, 0);
    const occupancyPct = workingMinutes > 0
      ? Number(new Prisma.Decimal(busyMinutes).mul(100).div(workingMinutes).toDecimalPlaces(2))
      : 0;
    return {
      barberId: barber.id,
      barberName: barber.name,
      workingMinutes,
      busyMinutes,
      idleMinutes,
      occupancyPct,
    };
  });
}

function slotMinutes(slot: { startTime: Date; endTime: Date; lunchStart: Date | null; lunchEnd: Date | null }) {
  const total = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
  if (!slot.lunchStart || !slot.lunchEnd) return total;
  return total - Math.max(timeToMinutes(slot.lunchEnd) - timeToMinutes(slot.lunchStart), 0);
}

function timeToMinutes(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

function overlapMinutes(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const from = Math.max(start.getTime(), rangeStart.getTime());
  const to = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(Math.round((to - from) / 60000), 0);
}

function isoWeekday(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
