import { PrismaClient } from '@prisma/client';

// Timeouts ampliados: o banco é remoto (Supabase) e as transações interativas
// do fluxo de agendamento fazem várias idas e voltas — o padrão de 5s não basta.
export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 15_000,
    timeout: 30_000,
  },
});
