"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const app_1 = require("./app");
const prisma_1 = require("./prisma");
const devBootstrap_1 = require("./config/devBootstrap");
const paymentHoldExpiration_job_1 = require("./jobs/paymentHoldExpiration.job");
const outboxProcessor_1 = require("./notification/outboxProcessor");
const winBack_job_1 = require("./jobs/winBack.job");
async function main() {
    const app = (0, app_1.createApp)();
    await (0, devBootstrap_1.devBootstrap)();
    const server = app.listen(config_1.config.PORT, () => {
        console.log(`[razorfy] servidor iniciado na porta ${config_1.config.PORT}`);
    });
    const jobs = [
        (0, paymentHoldExpiration_job_1.startPaymentHoldExpirationJob)(),
        (0, outboxProcessor_1.startOutboxProcessor)(),
        (0, winBack_job_1.startWinBackJob)(),
    ];
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown)
            return; // idempotente: evita disconnect dobrado em SIGINT repetido
        shuttingDown = true;
        console.log(`[razorfy] encerrando (${signal})...`);
        jobs.forEach(j => clearInterval(j));
        // Fallback: se server.close travar (keep-alive), força liberação do pool e saída.
        const force = setTimeout(() => {
            console.warn('[razorfy] shutdown forçado (timeout)');
            void prisma_1.prisma.$disconnect().finally(() => process.exit(0));
        }, 5000);
        force.unref();
        server.close(async () => {
            clearTimeout(force);
            await prisma_1.prisma.$disconnect();
            process.exit(0);
        });
    }
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}
main().catch(err => {
    console.error('[razorfy] falha na inicialização:', err);
    process.exit(1);
});
