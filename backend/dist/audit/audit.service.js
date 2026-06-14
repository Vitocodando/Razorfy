"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusChanged = statusChanged;
async function statusChanged(tx, appointmentId, fromStatus, toStatus, actorId, payload) {
    await tx.appointmentStatusHistory.create({
        data: {
            appointmentId,
            fromStatus,
            toStatus,
            changedBy: actorId,
            payload: payload,
        },
    });
    console.log(`[audit] appointment_status_changed from=${fromStatus} to=${toStatus} actor=${actorId ?? 'system'} appointment=${appointmentId}`);
}
