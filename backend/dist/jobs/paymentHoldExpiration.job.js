"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPaymentHoldExpiration = runPaymentHoldExpiration;
exports.startPaymentHoldExpirationJob = startPaymentHoldExpirationJob;
const prisma_1 = require("../prisma");
const appointment_service_1 = require("../appointment/appointment.service");
async function runPaymentHoldExpiration() {
    const expired = await prisma_1.prisma.appointment.findMany({
        where: {
            status: 'PENDING_PAYMENT',
            holdExpiresAt: { lte: new Date() },
        },
        select: { id: true },
    });
    let processed = 0;
    for (const { id } of expired) {
        try {
            await (0, appointment_service_1.expirePaymentHold)(id);
            processed++;
        }
        catch (err) {
            console.warn(`[hold-expiration] falha ao expirar appointment ${id}:`, err);
        }
    }
    return processed;
}
function startPaymentHoldExpirationJob() {
    return setInterval(async () => {
        try {
            await runPaymentHoldExpiration();
        }
        catch (err) {
            console.error('[hold-expiration] erro no job:', err);
        }
    }, 60_000);
}
