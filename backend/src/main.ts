import { config } from './config';
import { createApp } from './app';
import { prisma } from './prisma';
import { devBootstrap } from './config/devBootstrap';
import { startPaymentHoldExpirationJob } from './jobs/paymentHoldExpiration.job';
import { startOutboxProcessor } from './notification/outboxProcessor';

async function main() {
  const app = createApp();

  await devBootstrap();

  const server = app.listen(config.PORT, () => {
    console.log(`[razorfy] servidor iniciado na porta ${config.PORT}`);
  });

  const jobs = [
    startPaymentHoldExpirationJob(),
    startOutboxProcessor(),
  ];

  async function shutdown() {
    console.log('[razorfy] encerrando...');
    jobs.forEach(j => clearInterval(j));
    server.close(async () => {
      await prisma.$disconnect();
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
