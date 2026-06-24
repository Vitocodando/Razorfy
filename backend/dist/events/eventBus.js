"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDomainEvent = onDomainEvent;
exports.publishDomainEvent = publishDomainEvent;
const events_1 = require("events");
const crypto_1 = require("crypto");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(50);
const CHANNEL = 'domain';
// Registra um ouvinte. Cada handler é isolado: erro nele nunca propaga (V01).
function onDomainEvent(handler) {
    emitter.on(CHANNEL, (event) => {
        Promise.resolve()
            .then(() => handler(event))
            .catch(err => console.error('[event] EVENT_LISTENER_FAILED', err));
    });
}
// RN02: todo evento carrega tenantId. RN01: chamar SOMENTE após commit.
// Assíncrono (setImmediate) → não acrescenta latência à requisição HTTP original.
function publishDomainEvent(input) {
    const event = {
        eventId: (0, crypto_1.randomUUID)(),
        tenantId: input.tenantId,
        eventType: input.eventType,
        timestamp: new Date().toISOString(),
        payload: input.payload ?? {},
    };
    setImmediate(() => {
        try {
            emitter.emit(CHANNEL, event);
        }
        catch (err) {
            // EVENT_DISPATCH_FAILED — não bloqueante; só log.
            console.error('[event] EVENT_DISPATCH_FAILED', err);
        }
    });
}
// Listener default da Fase 1 (log/gancho). Removível/substituível na Fase 2.
onDomainEvent(event => {
    console.log(`[event] ${event.eventType} tenant=${event.tenantId.slice(0, 8)} ${JSON.stringify(event.payload)}`);
});
