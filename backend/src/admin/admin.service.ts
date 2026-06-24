import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { dateOnlyUtc, localDateString, localDayRangeUtc } from '../schedule/availability.service';
import * as cashbackSvc from '../cashback/cashback.service';
import * as auditSvc from '../audit/audit.service';
import * as notifSvc from '../notification/notification.service';
import * as settingsSvc from '../settings/settings.service';
import { config } from '../config';
import { publishDomainEvent } from '../events/eventBus';

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

// RF04: barbearia do admin (código de conexão para QR/compartilhamento).
export async function getMyBarbershop(tenantId: string) {
  const shop = await prisma.barbershop.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, connectionCode: true, logoUrl: true, isActive: true },
  });
  if (!shop) throw new BusinessError('TENANT_NOT_FOUND', 'Barbearia não encontrada.', 404);
  return shop;
}

export async function getGlobalSettings(tenantId: string) {
  return settingsSvc.publicSettings(await settingsSvc.getSettings(tenantId));
}

export async function updateGlobalSettings(adminId: string, tenantId: string, data: { noShowToleranceMinutes: number; defaultCashbackPct: number }) {
  const previous = await settingsSvc.getSettings(tenantId);
  const updated = await settingsSvc.updateSettings(tenantId, data);
  adminAuditLog(adminId, 'UPDATE_GLOBAL_SETTINGS', settingsSvc.publicSettings(previous), settingsSvc.publicSettings(updated));
  return settingsSvc.publicSettings(updated);
}

export async function listCoupons(tenantId: string) {
  return prisma.coupon.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
}

export async function createCoupon(tenantId: string, data: CouponInput) {
  return prisma.coupon.create({
    data: {
      tenantId,
      code: data.code,
      discountType: data.discountType,
      discountValue: new Prisma.Decimal(data.discountValue),
      maxUsesGlobal: data.maxUsesGlobal ?? null,
      expiresAt: new Date(data.expiresAt),
    },
  });
}

export async function updateCoupon(tenantId: string, id: string, data: CouponInput) {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current || current.tenantId !== tenantId) throw new BusinessError('COUPON_NOT_FOUND', 'Cupom não encontrado.', 404);
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

export async function deleteCoupon(tenantId: string, id: string) {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current || current.tenantId !== tenantId) throw new BusinessError('COUPON_NOT_FOUND', 'Cupom não encontrado.', 404);
  await prisma.coupon.delete({ where: { id } });
}

export async function listCommissions(tenantId: string) {
  return prisma.barberCommission.findMany({
    where: { tenantId },
    include: {
      barber: { select: { id: true, name: true } },
      service: { select: { id: true, name: true, price: true } },
    },
    orderBy: [{ barber: { name: 'asc' } }, { service: { name: 'asc' } }],
  });
}

export async function upsertCommission(adminId: string, tenantId: string, data: CommissionInput) {
  return prisma.$transaction(async tx => {
    await assertBarberAndService(tx, data.barberId, data.serviceId, tenantId);

    const previous = await tx.barberCommission.findUnique({
      where: { barberId_serviceId: { barberId: data.barberId, serviceId: data.serviceId } },
    });

    const commission = await tx.barberCommission.upsert({
      where: { barberId_serviceId: { barberId: data.barberId, serviceId: data.serviceId } },
      update: { commissionPct: new Prisma.Decimal(data.commissionPct) },
      create: {
        tenantId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        commissionPct: new Prisma.Decimal(data.commissionPct),
      },
    });

    adminAuditLog(adminId, 'UPSERT_BARBER_COMMISSION', previous, commission);
    return commission;
  });
}

export async function deleteCommission(adminId: string, tenantId: string, id: string) {
  const previous = await prisma.barberCommission.findUnique({ where: { id } });
  if (!previous || previous.tenantId !== tenantId) throw new BusinessError('COMMISSION_NOT_FOUND', 'Regra de comissão não encontrada.', 404);
  await prisma.barberCommission.delete({ where: { id } });
  adminAuditLog(adminId, 'DELETE_BARBER_COMMISSION', previous, null);
}

export async function getCommissionSettlement(tenantId: string, from?: string, to?: string) {
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
      tenantId,
      status: 'CONCLUDED',
      startTimestamp: { gte: dayStartUtc, lt: dayEndUtc },
    },
    include: {
      barber: { select: { id: true, name: true } },
      services: true,
    },
    orderBy: { startTimestamp: 'asc' },
  });

  const commissions = await prisma.barberCommission.findMany({ where: { tenantId } });
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

export async function applyNoShow(adminId: string, tenantId: string, appointmentId: string, reason?: string) {
  const result = await prisma.$transaction(async tx => {
    const appt = await lockAppointmentForAdmin(tx, appointmentId);
    if (appt.tenantId !== tenantId) {
      throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    }
    const previousStatus = appt.status;

    if (appt.status !== 'CONFIRMED') {
      throw new BusinessError('INVALID_APPOINTMENT_STATE', 'Apenas agendamentos confirmados podem receber No-Show.', 422);
    }

    const tolerance = await settingsSvc.getNoShowToleranceMinutes(tenantId);
    const dueAt = new Date(appt.startTimestamp.getTime() + tolerance * 60 * 1000);
    if (new Date() <= dueAt) {
      throw new BusinessError(
        'APPOINTMENT_NOT_YET_DUE',
        `O agendamento ainda não ultrapassou o período de tolerância de ${tolerance} minutos para ser classificado como No-Show.`,
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
  // RN01: evento pós-commit (tenant do admin autenticado).
  publishDomainEvent({
    tenantId,
    eventType: 'APPOINTMENT_NO_SHOW',
    payload: { appointmentId: result.appointmentId, status: result.newStatus },
  });
  return result;
}

export async function listVacationBlocks(tenantId: string) {
  return prisma.vacationBlock.findMany({
    where: { tenantId },
    include: { barber: { select: { id: true, name: true } } },
    orderBy: [{ startDate: 'asc' }, { barber: { name: 'asc' } }],
  });
}

export async function createVacationBlock(adminId: string, tenantId: string, data: VacationInput) {
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
    const barberRows = await (tx as typeof prisma).$queryRaw<Array<{ id: string; role: string; name: string; tenant_id: string }>>`
      SELECT id, role, name, tenant_id FROM users WHERE id = ${data.barberId}::uuid FOR UPDATE
    `;
    if (barberRows.length === 0 || barberRows[0].role !== 'BARBER' || barberRows[0].tenant_id !== tenantId) {
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
      data: { tenantId, barberId: data.barberId, startDate, endDate },
    });
    adminAuditLog(adminId, 'CREATE_VACATION_BLOCK', null, { ...block, reason: data.reason ?? null });
    return block;
  });
}

export async function deleteVacationBlock(adminId: string, tenantId: string, id: string) {
  const previous = await prisma.vacationBlock.findUnique({ where: { id } });
  if (!previous || previous.tenantId !== tenantId) throw new BusinessError('VACATION_NOT_FOUND', 'Bloqueio de férias não encontrado.', 404);
  await prisma.vacationBlock.delete({ where: { id } });
  adminAuditLog(adminId, 'DELETE_VACATION_BLOCK', previous, null);
}

export async function getGlobalGrid(tenantId: string, date = localDateString()) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const dateOnly = dateOnlyUtc(date);
  const [barbers, appointments, vacations] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'BARBER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
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
        tenantId,
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

export async function refreshDailyReport(tenantId: string, date = localDateString()) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const reportDate = dateOnlyUtc(date);
  const [daily, lifetime, heatmap] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTimestamp: { gte: dayStartUtc, lt: dayEndUtc },
        status: { in: ['CONCLUDED', 'NO_SHOW'] },
      },
      select: { status: true, totalPrice: true, amountPaid: true },
    }),
    prisma.$queryRaw<Array<{ net_revenue: string; clients: bigint }>>`
      SELECT COALESCE(SUM(amount_paid), 0)::text as net_revenue,
             COUNT(DISTINCT client_id) as clients
      FROM appointments
      WHERE status = 'CONCLUDED' AND tenant_id = ${tenantId}::uuid
    `,
    occupancyHeatmap(tenantId, date),
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
    where: { tenantId_reportDate: { tenantId, reportDate } },
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
      tenantId,
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

export async function getDashboard(tenantId: string, date = localDateString()) {
  const [report, alerts, grid] = await Promise.all([
    refreshDailyReport(tenantId, date),
    listAdminAlerts(tenantId, 'PENDING'),
    getGlobalGrid(tenantId, date),
  ]);
  return { report, alerts: alerts.slice(0, 5), grid };
}

export async function listAdminAlerts(tenantId: string, status?: 'PENDING' | 'RESOLVED') {
  return prisma.adminAlert.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
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

export async function resolveAdminAlert(adminId: string, tenantId: string, id: string) {
  const alert = await prisma.adminAlert.findUnique({ where: { id } });
  if (!alert || alert.tenantId !== tenantId) throw new BusinessError('ALERT_NOT_FOUND', 'Alerta não encontrado.', 404);
  return prisma.adminAlert.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: adminId },
  });
}

export async function runWinBackCampaign(tenantId: string, referenceDate = localDateString()) {
  const targetDate = addDays(referenceDate, -45);
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(referenceDate);
  const candidates = await prisma.$queryRaw<Array<{ id: string; name: string; phone: string }>>`
    SELECT u.id, u.name, u.phone
    FROM users u
    JOIN appointments a ON a.client_id = u.id
    WHERE u.role = 'CLIENT'
      AND u.tenant_id = ${tenantId}::uuid
      AND u.phone IS NOT NULL
      AND u.is_active = true
      AND u.is_anonymized = false
      AND u.notification_whatsapp_enabled = true
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

async function assertBarberAndService(tx: TxClient, barberId: string, serviceId: string, tenantId: string) {
  const [barber, service] = await Promise.all([
    tx.user.findUnique({ where: { id: barberId }, select: { role: true, tenantId: true } }),
    tx.service.findUnique({ where: { id: serviceId }, select: { id: true, tenantId: true } }),
  ]);
  if (!barber || barber.role !== 'BARBER' || barber.tenantId !== tenantId) {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }
  if (!service || service.tenantId !== tenantId) {
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

async function occupancyHeatmap(tenantId: string, date: string) {
  const { dayStartUtc, dayEndUtc } = localDayRangeUtc(date);
  const dayOfWeek = isoWeekday(date);
  const [barbers, appointments] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'BARBER' },
      select: {
        id: true,
        name: true,
        barberSlots: { where: { dayOfWeek } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
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

// ----- Gestão de Barbeiros e Serviços (RF06/RF07/RF08, RN06/RN07/RN08, V05/V06) -----

// RF06 / RN07: lista TODOS os barbeiros (ativos e inativos) com total de concluídos.
export async function listBarbersAdmin(tenantId: string) {
  const [barbers, counts] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'BARBER' },
      select: { id: true, name: true, email: true, phone: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.groupBy({ by: ['barberId'], where: { tenantId, status: 'CONCLUDED' }, _count: true }),
  ]);
  const countMap = new Map(counts.map(c => [c.barberId, c._count]));
  return barbers.map(b => ({
    barberId: b.id,
    name: b.name,
    email: b.email,
    phone: b.phone,
    isActive: b.isActive,
    totalAppointmentsConcluded: countMap.get(b.id) ?? 0,
  }));
}

// RF07 / RN07: lista TODO o catálogo (ativos e inativos) com nº de agendamentos atrelados.
export async function listServicesAdmin(tenantId: string) {
  const [services, counts] = await Promise.all([
    prisma.service.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.appointmentService.groupBy({ by: ['serviceId'], where: { tenantId }, _count: true }),
  ]);
  const countMap = new Map(counts.map(c => [c.serviceId, c._count]));
  return services.map(s => ({
    serviceId: s.id,
    name: s.name,
    price: s.price,
    durationMinutes: s.durationMinutes,
    isActive: s.active,
    totalAppointments: countMap.get(s.id) ?? 0,
  }));
}

// RF08 / V06 / RN08: ativa/inativa barbeiro (soft-delete). Não permite alterar ADMIN.
export async function setBarberStatus(adminId: string, tenantId: string, barberId: string, isActive: boolean) {
  const barber = await prisma.user.findUnique({
    where: { id: barberId },
    select: { id: true, name: true, role: true, isActive: true, tenantId: true },
  });
  if (barber && barber.role === 'ADMIN') {
    throw new BusinessError('CANNOT_MODIFY_ADMIN', 'Não é permitido alterar o status de um administrador.', 403);
  }
  if (!barber || barber.role !== 'BARBER' || barber.tenantId !== tenantId) {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }

  const updated = await prisma.user.update({ where: { id: barberId }, data: { isActive } });
  adminAuditLog(adminId, 'BARBER_STATUS_CHANGE', { barberId, isActive: barber.isActive }, { barberId, isActive });

  // RN08: ao inativar, alerta sobre agendamentos futuros CONFIRMED a realocar.
  let orphanedAppointments: Array<{ appointmentId: string; clientName: string; startTimestamp: Date }> = [];
  if (!isActive) {
    const future = await prisma.appointment.findMany({
      where: { tenantId, barberId, status: 'CONFIRMED', startTimestamp: { gt: new Date() } },
      include: { client: { select: { name: true } } },
      orderBy: { startTimestamp: 'asc' },
    });
    orphanedAppointments = future.map(a => ({
      appointmentId: a.id,
      clientName: a.client.name,
      startTimestamp: a.startTimestamp,
    }));
  }

  return {
    barberId,
    name: updated.name,
    previousStatus: barber.isActive,
    newStatus: updated.isActive,
    orphanedAppointments,
  };
}

// RF08 / V05: ativa/inativa serviço (usa services.active). Impede 2 ativos com mesmo nome.
export async function setServiceStatus(adminId: string, tenantId: string, serviceId: string, isActive: boolean) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new BusinessError('SERVICE_NOT_FOUND', 'Serviço não encontrado.', 404);

  if (isActive) {
    const duplicate = await prisma.service.findFirst({
      where: { tenantId, name: service.name, active: true, id: { not: serviceId } },
    });
    if (duplicate) {
      throw new BusinessError('DUPLICATE_ACTIVE_SERVICE', 'Já existe um serviço ativo com este nome.', 422);
    }
  }

  const updated = await prisma.service.update({ where: { id: serviceId }, data: { active: isActive } });
  adminAuditLog(adminId, 'SERVICE_STATUS_CHANGE', { serviceId, isActive: service.active }, { serviceId, isActive });

  return {
    serviceId,
    name: updated.name,
    previousStatus: service.active,
    newStatus: updated.active,
    message: isActive ? 'Serviço ativado com sucesso.' : 'Serviço desativado com sucesso. Histórico preservado.',
  };
}

// ----- Criação e deleção física de barbeiros e serviços (RN01/RN02/RN03, V01/V02) -----

// RF01 / V01 / RN02 / RN03: cria barbeiro (role forçada BARBER, senha BCrypt, email/phone únicos).
export async function createBarber(adminId: string, tenantId: string, data: { name: string; email: string; phone: string; initialPassword: string }) {
  const byEmail = await prisma.user.findFirst({ where: { tenantId, email: { equals: data.email, mode: 'insensitive' } } });
  if (byEmail) throw new BusinessError('DUPLICATE_EMAIL', 'Já existe um usuário com este e-mail.', 422);
  const byPhone = await prisma.user.findFirst({ where: { tenantId, phone: data.phone } });
  if (byPhone) throw new BusinessError('DUPLICATE_PHONE', 'Já existe um usuário com este telefone.', 422);

  const hash = await bcrypt.hash(data.initialPassword, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, password: hash, role: 'BARBER', isActive: true, tenantId },
  });
  adminAuditLog(adminId, 'BARBER_CREATE', null, { barberId: user.id, email: user.email });
  return { barberId: user.id, name: user.name, email: user.email, isActive: user.isActive, role: user.role };
}

// RF02 / RN03: cria serviço (nome único case-insensitive).
export async function createService(adminId: string, tenantId: string, data: { name: string; durationMinutes: number; price: number }) {
  const dup = await prisma.service.findFirst({ where: { tenantId, name: { equals: data.name, mode: 'insensitive' } } });
  if (dup) throw new BusinessError('DUPLICATE_SERVICE_NAME', 'Já existe um serviço com este nome.', 422);

  const service = await prisma.service.create({
    data: { name: data.name, durationMinutes: data.durationMinutes, price: new Prisma.Decimal(data.price).toDecimalPlaces(2), active: true, tenantId },
  });
  adminAuditLog(adminId, 'SERVICE_CREATE', null, { serviceId: service.id, name: service.name });
  return { serviceId: service.id, name: service.name, price: service.price, durationMinutes: service.durationMinutes, isActive: service.active };
}

// RF03 / V02 / RN01: hard-delete de barbeiro só sem agendamentos; limpa config própria na transação.
export async function deleteBarber(adminId: string, tenantId: string, barberId: string) {
  const barber = await prisma.user.findUnique({ where: { id: barberId }, select: { id: true, role: true, tenantId: true } });
  if (barber && barber.role === 'ADMIN') {
    throw new BusinessError('CANNOT_MODIFY_ADMIN', 'Não é permitido excluir um administrador.', 403);
  }
  if (!barber || barber.role !== 'BARBER' || barber.tenantId !== tenantId) {
    throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
  }
  const count = await prisma.appointment.count({ where: { barberId } });
  if (count > 0) {
    throw new BusinessError(
      'ENTITY_IN_USE',
      `Este barbeiro possui ${count} agendamento(s) atrelado(s) e não pode ser apagado. Utilize a função de inativação.`,
      409,
      { suggestion: `PATCH /api/v1/admin/barbers/${barberId}/status` },
    );
  }
  await prisma.$transaction([
    prisma.barberSlot.deleteMany({ where: { barberId } }),
    prisma.scheduleBlock.deleteMany({ where: { barberId } }),
    prisma.vacationBlock.deleteMany({ where: { barberId } }),
    prisma.barberGoal.deleteMany({ where: { barberId } }),
    prisma.barberCommission.deleteMany({ where: { barberId } }),
    prisma.review.deleteMany({ where: { barberId } }),
    prisma.clientNote.deleteMany({ where: { authorId: barberId } }),
    prisma.user.delete({ where: { id: barberId } }),
  ]);
  adminAuditLog(adminId, 'BARBER_HARD_DELETE', { barberId }, null);
}

// RF03 / V02 / RN01: hard-delete de serviço só sem agendamentos; limpa associações.
export async function deleteService(adminId: string, tenantId: string, serviceId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.tenantId !== tenantId) throw new BusinessError('SERVICE_NOT_FOUND', 'Serviço não encontrado.', 404);

  const count = await prisma.appointmentService.count({ where: { serviceId } });
  if (count > 0) {
    throw new BusinessError(
      'ENTITY_IN_USE',
      `Este serviço não pode ser excluído pois possui ${count} agendamento(s) atrelado(s). Inative-o para removê-lo do catálogo ativo.`,
      409,
      { suggestion: `PATCH /api/v1/admin/services/${serviceId}/status` },
    );
  }
  await prisma.$transaction([
    prisma.barberCommission.deleteMany({ where: { serviceId } }),
    prisma.service.delete({ where: { id: serviceId } }),
  ]);
  adminAuditLog(adminId, 'SERVICE_HARD_DELETE', { serviceId }, null);
}
