import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Internal diagnostic HTML pages are available only on this computer in development.
  // This does NOT replace DEV_PREVIEW_KEY validation on the protected API.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/kiem-tra-he-thong.html' || req.path === '/kiem-tra-ban-nhap.html') {
      const ip = req.socket.remoteAddress ?? '';
      if (process.env.NODE_ENV !== 'development' ||
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
        res.status(404).send('Not Found');
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  // One origin for frontend + API. Serve ONLY public/, never root or .env.
  app.useStaticAssets(join(process.cwd(), 'public'), { index: 'index.html', dotfiles: 'deny' });
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT is invalid');
  }
  // Bind to localhost in development. Do not expose dev preview on a LAN.
  await app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  console.log(`Website: http://127.0.0.1:${port}/`);
  console.log(`Goc Dan Sinh API: http://127.0.0.1:${port}/api/health`);
}

void bootstrap();
