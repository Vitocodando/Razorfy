import { Request, Response } from 'express';
import { createApp } from '../src/app';
import { devBootstrap } from '../src/config/devBootstrap';

// Handler serverless para o Vercel. O app Express é reaproveitado entre
// invocações no mesmo cold start; o bootstrap roda uma única vez por instância.
const app = createApp();
const bootstrap = devBootstrap().catch(err => {
  console.error('[razorfy] falha no bootstrap:', err);
});

export default async function handler(req: Request, res: Response) {
  await bootstrap;
  return app(req, res);
}
