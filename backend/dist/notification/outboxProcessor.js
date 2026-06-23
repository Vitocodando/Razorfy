"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOutbox = processOutbox;
exports.startOutboxProcessor = startOutboxProcessor;
const prisma_1 = require("../prisma");
const config_1 = require("../config");
const whatsapp_1 = require("./whatsapp");
async function processOutbox() {
    const messages = await prisma_1.prisma.notificationOutbox.findMany({
        where: {
            status: 'PENDING',
            nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
    });
    let sent = 0;
    for (const msg of messages) {
        try {
            // RN03: respeita o consentimento de notificação do destinatário; canal desligado é descartado.
            if (!(await channelAllowed(msg))) {
                await prisma_1.prisma.notificationOutbox.update({
                    where: { id: msg.id },
                    data: { status: 'SENT', sentAt: new Date(), lastError: 'skipped: channel disabled by user', attempts: { increment: 1 } },
                });
                continue;
            }
            await send(msg);
            await prisma_1.prisma.notificationOutbox.update({
                where: { id: msg.id },
                data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
            });
            sent++;
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const nextAttempt = new Date(Date.now() + 5 * 60 * 1000);
            const newAttempts = msg.attempts + 1;
            if (newAttempts >= config_1.config.NOTIFICATION_MAX_ATTEMPTS) {
                await prisma_1.prisma.notificationOutbox.update({
                    where: { id: msg.id },
                    data: { status: 'FAILED', lastError: errMsg, attempts: newAttempts },
                });
            }
            else {
                await prisma_1.prisma.notificationOutbox.update({
                    where: { id: msg.id },
                    data: { lastError: errMsg, attempts: newAttempts, nextAttemptAt: nextAttempt },
                });
            }
            console.warn(`[outbox] falha ao enviar ${msg.eventType}: ${errMsg}`);
        }
    }
    return sent;
}
function startOutboxProcessor() {
    return setInterval(async () => {
        try {
            await processOutbox();
        }
        catch (err) {
            console.error('[outbox] erro no processador:', err);
        }
    }, 5_000);
}
async function channelAllowed(msg) {
    if (msg.channel === 'PUSH') {
        const u = await prisma_1.prisma.user
            .findUnique({ where: { id: msg.destination }, select: { notificationPushEnabled: true } })
            .catch(() => null);
        return u ? u.notificationPushEnabled : true;
    }
    if (msg.channel === 'WHATSAPP') {
        const u = await prisma_1.prisma.user.findFirst({
            where: { phone: msg.destination },
            select: { notificationWhatsappEnabled: true },
        });
        return u ? u.notificationWhatsappEnabled : true;
    }
    return true;
}
async function send(msg) {
    if (msg.channel === 'PUSH') {
        console.log(`[push] enviado para ${msg.destination}: ${msg.eventType}`);
        return;
    }
    // WHATSAPP via Z-API: renderiza texto pt-BR do payload e envia.
    const payload = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {});
    await (0, whatsapp_1.sendWhatsappText)(msg.destination, (0, whatsapp_1.renderMessage)(msg.eventType, payload));
}
