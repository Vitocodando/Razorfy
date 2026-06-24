import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// FEAT-080: barramento de eventos de domínio em memória (Pub/Sub local).
// Fase 1: listener default só loga / serve de gancho. Fase 2 (WebSocket/SSE):
// criar um novo listener via onDomainEvent — sem tocar nos serviços de negócio.

export type DomainEventType =
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELED'
  | 'APPOINTMENT_CONCLUDED'
  | 'APPOINTMENT_NO_SHOW'
  | 'SERVICE_UPDATED'
  | 'BARBER_UPDATED';

export interface DomainEvent {
  eventId: string;
  tenantId: string;
  eventType: DomainEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

const emitter = new EventEmitter();
emitter.setMaxListeners(50);
const CHANNEL = 'domain';

// Registra um ouvinte. Cada handler é isolado: erro nele nunca propaga (V01).
export function onDomainEvent(handler: DomainEventHandler): void {
  emitter.on(CHANNEL, (event: DomainEvent) => {
    Promise.resolve()
      .then(() => handler(event))
      .catch(err => console.error('[event] EVENT_LISTENER_FAILED', err));
  });
}

// RN02: todo evento carrega tenantId. RN01: chamar SOMENTE após commit.
// Assíncrono (setImmediate) → não acrescenta latência à requisição HTTP original.
export function publishDomainEvent(input: {
  tenantId: string;
  eventType: DomainEventType;
  payload?: Record<string, unknown>;
}): void {
  const event: DomainEvent = {
    eventId: randomUUID(),
    tenantId: input.tenantId,
    eventType: input.eventType,
    timestamp: new Date().toISOString(),
    payload: input.payload ?? {},
  };
  setImmediate(() => {
    try {
      emitter.emit(CHANNEL, event);
    } catch (err) {
      // EVENT_DISPATCH_FAILED — não bloqueante; só log.
      console.error('[event] EVENT_DISPATCH_FAILED', err);
    }
  });
}

// Listener default da Fase 1 (log/gancho). Removível/substituível na Fase 2.
onDomainEvent(event => {
  console.log(`[event] ${event.eventType} tenant=${event.tenantId.slice(0, 8)} ${JSON.stringify(event.payload)}`);
});
