"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Timeouts ampliados: o banco é remoto (Supabase) e as transações interativas
// do fluxo de agendamento fazem várias idas e voltas — o padrão de 5s não basta.
exports.prisma = new client_1.PrismaClient({
    transactionOptions: {
        maxWait: 15_000,
        timeout: 30_000,
    },
});
