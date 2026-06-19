import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from '../config';
import * as settingsSvc from '../settings/settings.service';
import { BusinessError } from '../common/BusinessError';
import { assertWorkingTime, dateOnlyUtc, localDateString } from '../schedule/availability.service';
import * as cashbackSvc from '../cashback/cashback.service';
import * as auditSvc from '../audit/audit.service';
import * as notifSvc from '../notification/notification.service';
import { createIntent, refund as gatewayRefund } from '../payment/mockGateway';
import { calculateEnd, canCancel } from './appointment.policy';

const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'];

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function lockAppointment(tx: TxClient, id: string) {
  const rows = await (tx as typeof prisma).$queryRaw<Array<{ id: string }>>`
    SELECT id FROM appointments WHERE id = ${id}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  return tx.appointment.findUniqueOrThrow({
    where: { id },
    include: {
      services: true,
      client: { select: { id: true, name: true, phone: true, role: true } },
      barber: { select: { id: true, name: true } },
    },
  });
}

function apptData(appt: Awaited<ReturnType<typeof lockAppointment>>) {
  return {
    id: appt.id,
    clientId: appt.client.id,
    clientName: appt.client.name,
    clientPhone: appt.client.phone,
    barberName: appt.barber.name,
    startTimestamp: appt.startTimestamp,
    status: appt.status,
  };
}

export async function createAppointment(clientId: string, body: {
  barberId: string;
  serviceIds: string[];
  startTimestamp: string;
  useCashback: boolean;
  cashbackAmountToApply?: number | null;
  couponCode?: string | null;
  paymentMethod: string;
}) {
  if (new Set(body.serviceIds).size !== body.serviceIds.length) {
    throw new BusinessError('DUPLICATE_SERVICES', 'Um serviço não pode ser selecionado mais de uma vez.', 400);
  }
  const couponCode = normalizeCouponCode(body.couponCode);
  const requestedCashbackFlag = body.useCashback || Number(body.cashbackAmountToApply ?? 0) > 0;
  if (couponCode && requestedCashbackFlag) {
    throw new BusinessError(
      'PROMOTION_CONFLICT',
      'Cupom de desconto e saldo de cashback não podem ser usados na mesma transação.',
      422,
    );
  }

  return prisma.$transaction(async tx => {
    const client = await tx.user.findUnique({ where: { id: clientId } });
    if (!client) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
    if (client.role !== 'CLIENT') {
      throw new BusinessError('CLIENT_REQUIRED', 'Apenas clientes podem criar agendamentos.', 403);
    }

    // Lock barber row
    const barberRows = await (tx as typeof prisma).$queryRaw<Array<{ id: string; role: string; name: string; is_active: boolean }>>`
      SELECT id, role, name, is_active FROM users WHERE id = ${body.barberId}::uuid FOR UPDATE
    `;
    if (barberRows.length === 0 || barberRows[0].role !== 'BARBER') {
      throw new BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
    }
    if (!barberRows[0].is_active) {
      throw new BusinessError('BARBER_INACTIVE', 'Este profissional não está disponível para novos agendamentos.', 422);
    }
    const barber = barberRows[0];

    const selectedServices = await tx.service.findMany({
      where: { id: { in: body.serviceIds }, active: true },
    });
    if (selectedServices.length !== body.serviceIds.length) {
      throw new BusinessError('SERVICE_NOT_FOUND', 'Um ou mais serviços não estão disponíveis.', 422);
    }

    const total = selectedServices.reduce(
      (acc, s) => acc.plus(s.price),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(2);

    const requestedCashback = normalizeCashback(body.useCashback, body.cashbackAmountToApply, selectedServices.map(s => s.price));

    const start = new Date(body.startTimestamp);
    const end = calculateEnd(start, selectedServices.map(s => s.durationMinutes));

    if (start <= new Date()) {
      throw new BusinessError('APPOINTMENT_MUST_BE_FUTURE', 'O agendamento deve estar no futuro.', 422);
    }

    await assertWorkingTime(barber.id, start, end);

    const overlapping = await tx.appointment.findMany({
      where: {
        barberId: barber.id,
        status: { in: BLOCKING_STATUSES },
        startTimestamp: { lt: end },
        endTimestamp: { gt: start },
      },
    });
    if (overlapping.length > 0) {
      throw new BusinessError('SLOT_ALREADY_BOOKED', 'O horário selecionado acabou de ser reservado. Por favor, escolha outra opção.', 409);
    }

    const blocking = await tx.scheduleBlock.findFirst({
      where: { barberId: barber.id, startTimestamp: { lt: end }, endTimestamp: { gt: start } },
    });
    if (blocking) {
      throw new BusinessError('SLOT_BLOCKED', 'O horário selecionado está bloqueado pelo profissional.', 409);
    }

    const appointmentLocalDate = dateOnlyUtc(localDateString(start));
    const vacation = await tx.vacationBlock.findFirst({
      where: {
        barberId: barber.id,
        startDate: { lte: appointmentLocalDate },
        endDate: { gte: appointmentLocalDate },
      },
    });
    if (vacation) {
      throw new BusinessError('SLOT_BLOCKED', 'O profissional está em férias no dia selecionado.', 409);
    }

    const coupon = couponCode ? await lockAndApplyCoupon(tx, couponCode, total) : null;

    const online = body.paymentMethod !== 'PRESENTIAL';
    const initialStatus = online ? 'PENDING_PAYMENT' : 'CONFIRMED';
    const holdExpiresAt = online
      ? new Date(Date.now() + config.PAYMENT_HOLD_MINUTES * 60 * 1000)
      : null;
    const amountPaid = total.minus(requestedCashback).minus(coupon?.discount ?? 0).toDecimalPlaces(2);

    const appointment = await tx.appointment.create({
      data: {
        clientId,
        barberId: barber.id,
        startTimestamp: start,
        endTimestamp: end,
        totalPrice: total,
        cashbackUsed: requestedCashback,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        couponDiscount: coupon?.discount ?? new Prisma.Decimal(0),
        amountPaid,
        paymentMethod: body.paymentMethod,
        status: initialStatus,
        holdExpiresAt,
        services: {
          create: selectedServices.map(s => ({
            serviceId: s.id,
            serviceName: s.name,
            durationMinutes: s.durationMinutes,
            price: s.price,
          })),
        },
      },
      include: {
        services: true,
        client: { select: { id: true, name: true, phone: true } },
        barber: { select: { id: true, name: true } },
      },
    });

    const wallet = await cashbackSvc.lockWallet(tx, clientId);
    await cashbackSvc.reserve(tx, wallet, appointment.id, requestedCashback);

    let paymentPayload = null;
    if (online) {
      const intent = createIntent(appointment.id, amountPaid.toFixed(2));
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { paymentReference: intent.reference },
      });
      paymentPayload = intent;
    } else {
      await cashbackSvc.debitReserved(tx, wallet, appointment.id, requestedCashback);
      const notifData = { id: appointment.id, clientId, clientName: client.name, clientPhone: client.phone, barberName: barber.name, startTimestamp: start, status: initialStatus };
      await notifSvc.appointmentEvent(tx, notifData, 'APPOINTMENT_CONFIRMED');
      await notifSvc.scheduleReminder(tx, notifData);
    }

    await auditSvc.statusChanged(tx, appointment.id, null, initialStatus, clientId, { source: 'CREATE' });

    return { appointment, paymentPayload };
  });
}

export async function confirmPayment(appointmentId: string, paymentReference: string) {
  return prisma.$transaction(async tx => {
    const appt = await lockAppointment(tx, appointmentId);
    if (appt.status === 'CONFIRMED') return appt;
    if (appt.status !== 'PENDING_PAYMENT') {
      throw new BusinessError('INVALID_PAYMENT_STATE', 'O agendamento não está aguardando pagamento.', 422);
    }
    if (appt.holdExpiresAt && appt.holdExpiresAt <= new Date()) {
      await expireHoldInTx(tx, appt);
      throw new BusinessError('PAYMENT_HOLD_EXPIRED', 'A reserva temporária expirou. Escolha um novo horário.', 422);
    }

    // Lock barber to check overlap
    await (tx as typeof prisma).$queryRaw`SELECT id FROM users WHERE id = ${appt.barberId}::uuid FOR UPDATE`;

    const conflict = await tx.appointment.findFirst({
      where: {
        barberId: appt.barberId,
        status: 'CONFIRMED',
        id: { not: appt.id },
        startTimestamp: { lt: appt.endTimestamp },
        endTimestamp: { gt: appt.startTimestamp },
      },
    });
    if (conflict) {
      await cancelOverbookingInTx(tx, appt);
      return tx.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    }

    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    await cashbackSvc.debitReserved(tx, wallet, appt.id, appt.cashbackUsed);

    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'CONFIRMED', paymentReference: paymentReference || appt.paymentReference },
      include: { client: { select: { id: true, name: true, phone: true, role: true } }, barber: { select: { id: true, name: true } } },
    });

    const notifData = apptData({ ...appt, status: 'CONFIRMED', client: updated.client, barber: updated.barber });
    await notifSvc.appointmentEvent(tx, notifData, 'APPOINTMENT_CONFIRMED');
    await notifSvc.scheduleReminder(tx, notifData);
    await auditSvc.statusChanged(tx, appt.id, 'PENDING_PAYMENT', 'CONFIRMED', null, { source: 'PAYMENT_WEBHOOK' });

    return updated;
  });
}

export async function cancelAppointment(appointmentId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const appt = await lockAppointment(tx, appointmentId);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);

    const isOwner = appt.clientId === actorId;
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'DEV';
    if (!isOwner && !isAdmin) {
      throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    }
    if (appt.status !== 'CONFIRMED' && appt.status !== 'PENDING_PAYMENT') {
      throw new BusinessError('INVALID_APPOINTMENT_STATE', 'Este agendamento não pode ser cancelado.', 422);
    }
    if (!canCancel(appt.startTimestamp, new Date())) {
      throw new BusinessError('INVALID_CANCEL_WINDOW', 'Cancelamentos automáticos só são permitidos com pelo menos 2 horas de antecedência.', 422);
    }

    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    const previous = appt.status;
    if (previous === 'PENDING_PAYMENT') {
      await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
    } else {
      await cashbackSvc.refund(tx, wallet, appt.id, appt.cashbackUsed);
      if (appt.paymentMethod !== 'PRESENTIAL') {
        gatewayRefund(appt.id, appt.paymentReference);
      }
    }

    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'CANCELLED' },
      include: { services: true, client: { select: { id: true, name: true, phone: true, role: true } }, barber: { select: { id: true, name: true } } },
    });

    await auditSvc.statusChanged(tx, appt.id, previous, 'CANCELLED', actorId, { source: 'CLIENT_CANCEL' });
    await notifSvc.appointmentEvent(tx, apptData({ ...appt, status: 'CANCELLED', client: updated.client, barber: updated.barber }), 'APPOINTMENT_CANCELLED');

    return updated;
  });
}

export async function concludeAppointment(appointmentId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const appt = await lockAppointment(tx, appointmentId);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);

    if (actor.role === 'CLIENT') {
      throw new BusinessError('STAFF_REQUIRED', 'Operação restrita à equipe.', 403);
    }
    if (actor.role === 'BARBER' && appt.barberId !== actorId) {
      throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    }
    if (appt.status !== 'CONFIRMED') {
      throw new BusinessError('INVALID_APPOINTMENT_STATE', 'Apenas agendamentos confirmados podem ser concluídos.', 422);
    }

    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    // Taxa de cashback parametrizável (global_settings); incide sobre o valor pago em dinheiro.
    const cashbackRate = await settingsSvc.getCashbackRate();
    const earned = await cashbackSvc.creditEarned(tx, wallet, appt.id, appt.amountPaid, cashbackRate);

    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'CONCLUDED', cashbackCredited: true },
      include: { services: true, client: { select: { id: true, name: true, phone: true, role: true } }, barber: { select: { id: true, name: true } } },
    });

    await auditSvc.statusChanged(tx, appt.id, 'CONFIRMED', 'CONCLUDED', actorId, { cashbackEarned: earned.toFixed(2) });
    await notifSvc.appointmentEvent(tx, apptData({ ...appt, status: 'CONCLUDED', client: updated.client, barber: updated.barber }), 'APPOINTMENT_CONCLUDED');

    return updated;
  });
}

export async function expirePaymentHold(appointmentId: string) {
  return prisma.$transaction(async tx => {
    const appt = await lockAppointment(tx, appointmentId);
    if (
      appt.status === 'PENDING_PAYMENT' &&
      appt.holdExpiresAt !== null &&
      appt.holdExpiresAt <= new Date()
    ) {
      await expireHoldInTx(tx, appt);
    }
  });
}

export async function listClientAppointments(clientId: string) {
  return prisma.appointment.findMany({
    where: { clientId },
    include: {
      services: true,
      barber: { select: { id: true, name: true } },
    },
    orderBy: { startTimestamp: 'desc' },
  });
}

export async function listBarberAppointments(barberId: string) {
  return prisma.appointment.findMany({
    where: { barberId },
    include: {
      services: true,
      client: { select: { id: true, name: true, phone: true } },
      barber: { select: { id: true, name: true } },
    },
    orderBy: { startTimestamp: 'desc' },
  });
}

// RF06: barbeiro aciona "Sua vez chegou" — enfileira push isolado para o cliente.
export async function callClient(appointmentId: string, actorId: string, actorRole: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { barber: { select: { id: true, name: true } } },
  });
  if (!appt) throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);

  const isAdmin = actorRole === 'ADMIN' || actorRole === 'DEV';
  if (!isAdmin && appt.barberId !== actorId) {
    throw new BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  if (appt.status !== 'CONFIRMED') {
    throw new BusinessError('INVALID_APPOINTMENT_STATE', 'Só é possível chamar clientes de atendimentos confirmados.', 422);
  }

  await notifSvc.barberCall(prisma, {
    clientId: appt.clientId,
    appointmentId: appt.id,
    barberName: appt.barber.name,
  });
  return { ok: true };
}

async function expireHoldInTx(tx: TxClient, appt: Awaited<ReturnType<typeof lockAppointment>>) {
  const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
  await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
  await tx.appointment.update({ where: { id: appt.id }, data: { status: 'EXPIRED_PAYMENT' } });
  await auditSvc.statusChanged(tx, appt.id, 'PENDING_PAYMENT', 'EXPIRED_PAYMENT', null, { source: 'HOLD_EXPIRATION' });
}

async function cancelOverbookingInTx(tx: TxClient, appt: Awaited<ReturnType<typeof lockAppointment>>) {
  const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
  await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
  await tx.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED_OVERBOOKING' } });
  gatewayRefund(appt.id, appt.paymentReference);
  await auditSvc.statusChanged(tx, appt.id, 'PENDING_PAYMENT', 'CANCELLED_OVERBOOKING', null, { source: 'OVERBOOKING' });
}

function normalizeCouponCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9]{1,20}$/.test(normalized)) {
    throw new BusinessError('INVALID_COUPON_CODE', 'Código de cupom inválido.', 400);
  }
  return normalized;
}

async function lockAndApplyCoupon(tx: TxClient, code: string, total: Prisma.Decimal) {
  const rows = await (tx as typeof prisma).$queryRaw<Array<{
    id: string;
    code: string;
    discountType: string;
    discountValue: Prisma.Decimal;
    maxUsesGlobal: number | null;
    currentUses: number;
    expiresAt: Date;
  }>>`
    SELECT id,
           code,
           discount_type as "discountType",
           discount_value as "discountValue",
           max_uses_global as "maxUsesGlobal",
           current_uses as "currentUses",
           expires_at as "expiresAt"
    FROM coupons
    WHERE code = ${code}
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new BusinessError('COUPON_NOT_FOUND', 'Cupom não encontrado.', 404);
  }

  const coupon = rows[0];
  if (coupon.expiresAt <= new Date()) {
    throw new BusinessError('COUPON_EXPIRED', 'Este cupom expirou e não é mais válido.', 422);
  }
  if (coupon.maxUsesGlobal !== null && coupon.currentUses >= coupon.maxUsesGlobal) {
    throw new BusinessError(
      'COUPON_LIMIT_REACHED',
      'Este cupom esgotou o número máximo de utilizações e não é mais válido.',
      422,
    );
  }

  const discount = coupon.discountType === 'PERCENTAGE'
    ? total.mul(coupon.discountValue).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : (coupon.discountValue.greaterThan(total) ? total : coupon.discountValue).toDecimalPlaces(2);

  await tx.coupon.update({
    where: { id: coupon.id },
    data: { currentUses: { increment: 1 } },
  });

  return { id: coupon.id, code: coupon.code, discount };
}

function normalizeCashback(
  useCashback: boolean,
  amount: number | null | undefined,
  servicePrices: Prisma.Decimal[],
): Prisma.Decimal {
  if (!useCashback) {
    if (amount && amount > 0) {
      throw new BusinessError('INVALID_CASHBACK_AMOUNT', 'Ative o uso de cashback para informar um valor.', 422);
    }
    return new Prisma.Decimal(0);
  }
  const dec = new Prisma.Decimal(amount ?? 0).toDecimalPlaces(2);
  if (dec.lessThanOrEqualTo(0)) {
    throw new BusinessError('INVALID_CASHBACK_AMOUNT', 'O valor de cashback deve ser maior que zero.', 422);
  }
  // Sem pagamento no app: cashback paga serviços COMPLETOS (nunca abatimento parcial de um serviço).
  // O valor aplicado deve corresponder à soma de algum subconjunto dos serviços selecionados.
  if (!isSubsetSumOfServices(servicePrices, dec)) {
    throw new BusinessError(
      'CASHBACK_PARTIAL_SERVICE',
      'O cashback só pode pagar serviços inteiros — o valor deve corresponder à soma de um ou mais serviços selecionados.',
      422,
    );
  }
  return dec;
}

// Verifica se `target` (em reais) é a soma de algum subconjunto dos preços (em centavos, exato).
function isSubsetSumOfServices(prices: Prisma.Decimal[], target: Prisma.Decimal): boolean {
  const cents = prices.map(p => p.times(100).toNearest(1).toNumber());
  const targetCents = target.times(100).toNearest(1).toNumber();
  if (targetCents === 0) return false;
  const reachable = new Set<number>([0]);
  for (const c of cents) {
    for (const sum of [...reachable]) reachable.add(sum + c);
  }
  return reachable.has(targetCents);
}
