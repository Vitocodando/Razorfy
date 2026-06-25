import { config } from '../config';

// Adapter WaSenderAPI (FEAT-079). Envia texto livre (não exige template HSM da Meta).
// WHATSAPP_GATEWAY_URL = endpoint de envio (ex.: https://wasenderapi.com/api/send-message).
// WHATSAPP_API_KEY     = chave da conta (header Authorization: Bearer ...).

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type Payload = Record<string, unknown>;
const str = (p: Payload, k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');

// Renderiza o texto pt-BR a partir do eventType + payload do outbox.
export function renderMessage(eventType: string, payload: Payload): string {
  const cliente = str(payload, 'clientName');
  const barbeiro = str(payload, 'barberName');
  const inicio = str(payload, 'startTimestamp');
  switch (eventType) {
    case 'APPOINTMENT_CONFIRMED':
      return `Olá ${cliente}! Seu horário com ${barbeiro} está confirmado para ${fmtDateTime(inicio)}. — Razorfy 💈`;
    case 'APPOINTMENT_CANCELLED':
      return `Olá ${cliente}, seu horário com ${barbeiro} em ${fmtDateTime(inicio)} foi cancelado.`;
    case 'APPOINTMENT_CONCLUDED':
      return `Obrigado pela visita, ${cliente}! Atendimento com ${barbeiro} concluído. Volte sempre! 💈`;
    case 'APPOINTMENT_REMINDER':
      return `Lembrete: você tem horário com ${barbeiro} hoje às ${fmtTime(inicio)}. Até já! — Razorfy`;
    default:
      // NO_SHOW_PENALTY, WIN_BACK e afins já trazem um texto pronto em `body`.
      return str(payload, 'body') || 'Você tem uma atualização do seu agendamento na Razorfy.';
  }
}

export function whatsappConfigured(): boolean {
  return Boolean(config.WHATSAPP_GATEWAY_URL && config.WHATSAPP_API_KEY);
}

// Envia texto via WaSenderAPI. Contrato: POST com header Authorization: Bearer <API_KEY>
// e body { to, text }. `to` em E.164 (com '+'). Lança em falha (processor faz retry/backoff).
export async function sendWhatsappText(destination: string, message: string): Promise<void> {
  const url = config.WHATSAPP_GATEWAY_URL;
  if (!url || !config.WHATSAPP_API_KEY) {
    console.log(`[whatsapp] (simulado, sem gateway) ${destination}: ${message}`);
    return;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.WHATSAPP_API_KEY}`,
    },
    body: JSON.stringify({ to: destination, text: message }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`WaSenderAPI HTTP ${response.status} ${text.slice(0, 200)}`);
  }
}
