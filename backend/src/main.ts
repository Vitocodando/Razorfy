import { config } from './config';
import { createApp } from './app';
import { prisma } from './prisma';
import { devBootstrap } from './config/devBootstrap';
import { startPaymentHoldExpirationJob } from './jobs/paymentHoldExpiration.job';
import { startOutboxProcessor } from './notification/outboxProcessor';
import { startWinBackJob } from './jobs/winBack.job';
import { startGeneratePayablesJob } from './jobs/generatePayables.job';

async function main() {
  const app = createApp();

  await devBootstrap();

  const server = app.listen(config.PORT, () => {
    console.log(`[razorfy] servidor iniciado na porta ${config.PORT}`);
  });

  const jobs = [
    startPaymentHoldExpirationJob(),
    startOutboxProcessor(),
    startWinBackJob(),
    startGeneratePayablesJob(),
  ];

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return; // idempotente: evita disconnect dobrado em SIGINT repetido
    shuttingDown = true;
    console.log(`[razorfy] encerrando (${signal})...`);
    jobs.forEach(j => clearInterval(j));

    // Fallback: se server.close travar (keep-alive), força liberação do pool e saída.
    const force = setTimeout(() => {
      console.warn('[razorfy] shutdown forçado (timeout)');
      void prisma.$disconnect().finally(() => process.exit(0));
    }, 5000);
    force.unref();

    server.close(async () => {
      clearTimeout(force);
      await prisma.$disconnect();
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
