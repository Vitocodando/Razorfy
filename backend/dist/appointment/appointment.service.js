"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointment = createAppointment;
exports.confirmPayment = confirmPayment;
exports.cancelAppointment = cancelAppointment;
exports.concludeAppointment = concludeAppointment;
exports.expirePaymentHold = expirePaymentHold;
exports.listClientAppointments = listClientAppointments;
exports.listBarberAppointments = listBarberAppointments;
exports.callClient = callClient;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const config_1 = require("../config");
const BusinessError_1 = require("../common/BusinessError");
const availability_service_1 = require("../schedule/availability.service");
const cashbackSvc = __importStar(require("../cashback/cashback.service"));
const auditSvc = __importStar(require("../audit/audit.service"));
const notifSvc = __importStar(require("../notification/notification.service"));
const mockGateway_1 = require("../payment/mockGateway");
const appointment_policy_1 = require("./appointment.policy");
const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'];
async function lockAppointment(tx, id) {
    const rows = await tx.$queryRaw `
    SELECT id FROM appointments WHERE id = ${id}::uuid FOR UPDATE
  `;
    if (rows.length === 0) {
        throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
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
function apptData(appt) {
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
async function createAppointment(clientId, body) {
    if (new Set(body.serviceIds).size !== body.serviceIds.length) {
        throw new BusinessError_1.BusinessError('DUPLICATE_SERVICES', 'Um serviço não pode ser selecionado mais de uma vez.', 400);
    }
    return prisma_1.prisma.$transaction(async (tx) => {
        const client = await tx.user.findUnique({ where: { id: clientId } });
        if (!client)
            throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
        if (client.role !== 'CLIENT') {
            throw new BusinessError_1.BusinessError('CLIENT_REQUIRED', 'Apenas clientes podem criar agendamentos.', 403);
        }
        // Lock barber row
        const barberRows = await tx.$queryRaw `
      SELECT id, role, name FROM users WHERE id = ${body.barberId}::uuid FOR UPDATE
    `;
        if (barberRows.length === 0 || barberRows[0].role !== 'BARBER') {
            throw new BusinessError_1.BusinessError('BARBER_NOT_FOUND', 'Profissional não encontrado.', 404);
        }
        const barber = barberRows[0];
        const selectedServices = await tx.service.findMany({
            where: { id: { in: body.serviceIds }, active: true },
        });
        if (selectedServices.length !== body.serviceIds.length) {
            throw new BusinessError_1.BusinessError('SERVICE_NOT_FOUND', 'Um ou mais serviços não estão disponíveis.', 422);
        }
        const total = selectedServices.reduce((acc, s) => acc.plus(s.price), new client_1.Prisma.Decimal(0)).toDecimalPlaces(2);
        const requestedCashback = normalizeCashback(body.useCashback, body.cashbackAmountToApply, total);
        const start = new Date(body.startTimestamp);
        const end = (0, appointment_policy_1.calculateEnd)(start, selectedServices.map(s => s.durationMinutes));
        if (start <= new Date()) {
            throw new BusinessError_1.BusinessError('APPOINTMENT_MUST_BE_FUTURE', 'O agendamento deve estar no futuro.', 422);
        }
        await (0, availability_service_1.assertWorkingTime)(barber.id, start, end);
        const overlapping = await tx.appointment.findMany({
            where: {
                barberId: barber.id,
                status: { in: BLOCKING_STATUSES },
                startTimestamp: { lt: end },
                endTimestamp: { gt: start },
            },
        });
        if (overlapping.length > 0) {
            throw new BusinessError_1.BusinessError('SLOT_ALREADY_BOOKED', 'O horário selecionado acabou de ser reservado. Por favor, escolha outra opção.', 409);
        }
        const blocking = await tx.scheduleBlock.findFirst({
            where: { barberId: barber.id, startTimestamp: { lt: end }, endTimestamp: { gt: start } },
        });
        if (blocking) {
            throw new BusinessError_1.BusinessError('SLOT_BLOCKED', 'O horário selecionado está bloqueado pelo profissional.', 409);
        }
        const online = body.paymentMethod !== 'PRESENTIAL';
        const initialStatus = online ? 'PENDING_PAYMENT' : 'CONFIRMED';
        const holdExpiresAt = online
            ? new Date(Date.now() + config_1.config.PAYMENT_HOLD_MINUTES * 60 * 1000)
            : null;
        const amountPaid = total.minus(requestedCashback).toDecimalPlaces(2);
        const appointment = await tx.appointment.create({
            data: {
                clientId,
                barberId: barber.id,
                startTimestamp: start,
                endTimestamp: end,
                totalPrice: total,
                cashbackUsed: requestedCashback,
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
            const intent = (0, mockGateway_1.createIntent)(appointment.id, amountPaid.toFixed(2));
            await tx.appointment.update({
                where: { id: appointment.id },
                data: { paymentReference: intent.reference },
            });
            paymentPayload = intent;
        }
        else {
            await cashbackSvc.debitReserved(tx, wallet, appointment.id, requestedCashback);
            const notifData = { id: appointment.id, clientId, clientName: client.name, clientPhone: client.phone, barberName: barber.name, startTimestamp: start, status: initialStatus };
            await notifSvc.appointmentEvent(tx, notifData, 'APPOINTMENT_CONFIRMED');
            await notifSvc.scheduleReminder(tx, notifData);
        }
        await auditSvc.statusChanged(tx, appointment.id, null, initialStatus, clientId, { source: 'CREATE' });
        return { appointment, paymentPayload };
    });
}
async function confirmPayment(appointmentId, paymentReference) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const appt = await lockAppointment(tx, appointmentId);
        if (appt.status === 'CONFIRMED')
            return appt;
        if (appt.status !== 'PENDING_PAYMENT') {
            throw new BusinessError_1.BusinessError('INVALID_PAYMENT_STATE', 'O agendamento não está aguardando pagamento.', 422);
        }
        if (appt.holdExpiresAt && appt.holdExpiresAt <= new Date()) {
            await expireHoldInTx(tx, appt);
            throw new BusinessError_1.BusinessError('PAYMENT_HOLD_EXPIRED', 'A reserva temporária expirou. Escolha um novo horário.', 422);
        }
        // Lock barber to check overlap
        await tx.$queryRaw `SELECT id FROM users WHERE id = ${appt.barberId}::uuid FOR UPDATE`;
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
async function cancelAppointment(appointmentId, actorId) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const appt = await lockAppointment(tx, appointmentId);
        const actor = await tx.user.findUnique({ where: { id: actorId } });
        if (!actor)
            throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
        const isOwner = appt.clientId === actorId;
        const isAdmin = actor.role === 'ADMIN' || actor.role === 'DEV';
        if (!isOwner && !isAdmin) {
            throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
        }
        if (appt.status !== 'CONFIRMED' && appt.status !== 'PENDING_PAYMENT') {
            throw new BusinessError_1.BusinessError('INVALID_APPOINTMENT_STATE', 'Este agendamento não pode ser cancelado.', 422);
        }
        if (!(0, appointment_policy_1.canCancel)(appt.startTimestamp, new Date())) {
            throw new BusinessError_1.BusinessError('INVALID_CANCEL_WINDOW', 'Cancelamentos automáticos só são permitidos com pelo menos 2 horas de antecedência.', 422);
        }
        const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
        const previous = appt.status;
        if (previous === 'PENDING_PAYMENT') {
            await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
        }
        else {
            await cashbackSvc.refund(tx, wallet, appt.id, appt.cashbackUsed);
            if (appt.paymentMethod !== 'PRESENTIAL') {
                (0, mockGateway_1.refund)(appt.id, appt.paymentReference);
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
async function concludeAppointment(appointmentId, actorId) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const appt = await lockAppointment(tx, appointmentId);
        const actor = await tx.user.findUnique({ where: { id: actorId } });
        if (!actor)
            throw new BusinessError_1.BusinessError('USER_NOT_FOUND', 'Usuário não encontrado.', 404);
        if (actor.role === 'CLIENT') {
            throw new BusinessError_1.BusinessError('STAFF_REQUIRED', 'Operação restrita à equipe.', 403);
        }
        if (actor.role === 'BARBER' && appt.barberId !== actorId) {
            throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
        }
        if (appt.status !== 'CONFIRMED') {
            throw new BusinessError_1.BusinessError('INVALID_APPOINTMENT_STATE', 'Apenas agendamentos confirmados podem ser concluídos.', 422);
        }
        const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
        // Cashback = 10% sobre o valor efetivamente pago em dinheiro (amountPaid); valor pago com cashback não gera novo cashback.
        const earned = await cashbackSvc.creditEarned(tx, wallet, appt.id, appt.amountPaid, config_1.config.CASHBACK_RATE);
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
async function expirePaymentHold(appointmentId) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const appt = await lockAppointment(tx, appointmentId);
        if (appt.status === 'PENDING_PAYMENT' &&
            appt.holdExpiresAt !== null &&
            appt.holdExpiresAt <= new Date()) {
            await expireHoldInTx(tx, appt);
        }
    });
}
async function listClientAppointments(clientId) {
    return prisma_1.prisma.appointment.findMany({
        where: { clientId },
        include: {
            services: true,
            barber: { select: { id: true, name: true } },
        },
        orderBy: { startTimestamp: 'desc' },
    });
}
async function listBarberAppointments(barberId) {
    return prisma_1.prisma.appointment.findMany({
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
async function callClient(appointmentId, actorId, actorRole) {
    const appt = await prisma_1.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { barber: { select: { id: true, name: true } } },
    });
    if (!appt)
        throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    const isAdmin = actorRole === 'ADMIN' || actorRole === 'DEV';
    if (!isAdmin && appt.barberId !== actorId) {
        throw new BusinessError_1.BusinessError('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.', 404);
    }
    if (appt.status !== 'CONFIRMED') {
        throw new BusinessError_1.BusinessError('INVALID_APPOINTMENT_STATE', 'Só é possível chamar clientes de atendimentos confirmados.', 422);
    }
    await notifSvc.barberCall(prisma_1.prisma, {
        clientId: appt.clientId,
        appointmentId: appt.id,
        barberName: appt.barber.name,
    });
    return { ok: true };
}
async function expireHoldInTx(tx, appt) {
    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
    await tx.appointment.update({ where: { id: appt.id }, data: { status: 'EXPIRED_PAYMENT' } });
    await auditSvc.statusChanged(tx, appt.id, 'PENDING_PAYMENT', 'EXPIRED_PAYMENT', null, { source: 'HOLD_EXPIRATION' });
}
async function cancelOverbookingInTx(tx, appt) {
    const wallet = await cashbackSvc.lockWallet(tx, appt.clientId);
    await cashbackSvc.release(tx, wallet, appt.id, appt.cashbackUsed);
    await tx.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED_OVERBOOKING' } });
    (0, mockGateway_1.refund)(appt.id, appt.paymentReference);
    await auditSvc.statusChanged(tx, appt.id, 'PENDING_PAYMENT', 'CANCELLED_OVERBOOKING', null, { source: 'OVERBOOKING' });
}
function normalizeCashback(useCashback, amount, total) {
    if (!useCashback) {
        if (amount && amount > 0) {
            throw new BusinessError_1.BusinessError('INVALID_CASHBACK_AMOUNT', 'Ative o uso de cashback para informar um valor.', 422);
        }
        return new client_1.Prisma.Decimal(0);
    }
    if (!amount || amount <= 0) {
        throw new BusinessError_1.BusinessError('INVALID_CASHBACK_AMOUNT', 'O valor de cashback deve ser maior que zero.', 422);
    }
    const dec = new client_1.Prisma.Decimal(amount).toDecimalPlaces(2);
    if (dec.greaterThan(total)) {
        throw new BusinessError_1.BusinessError('CASHBACK_EXCEEDS_TOTAL', 'O cashback aplicado não pode exceder o valor total do agendamento.', 422);
    }
    return dec;
}
