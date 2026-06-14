"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const app_1 = require("./app");
const prisma_1 = require("./prisma");
const devBootstrap_1 = require("./config/devBootstrap");
const paymentHoldExpiration_job_1 = require("./jobs/paymentHoldExpiration.job");
const outboxProcessor_1 = require("./notification/outboxProcessor");
async function main() {
    const app = (0, app_1.createApp)();
    await (0, devBootstrap_1.devBootstrap)();
    const server = app.listen(config_1.config.PORT, () => {
        console.log(`[razorfy] servidor iniciado na porta ${config_1.config.PORT}`);
    });
    const jobs = [
        (0, paymentHoldExpiration_job_1.startPaymentHoldExpirationJob)(),
        (0, outboxProcessor_1.startOutboxProcessor)(),
    ];
    async function shutdown() {
        console.log('[razorfy] encerrando...');
        jobs.forEach(j => clearInterval(j));
        server.close(async () => {
            await prisma_1.prisma.$disconnect();
            process.exit(0);
        });
    }
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
main().catch(err => {
    console.error('[razorfy] falha na inicialização:', err);
    process.exit(1);
});
