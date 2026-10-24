import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class DevPreviewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'development') throw new ForbiddenException();
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
      throw new ForbiddenException();
    }
    const key = process.env.DEV_PREVIEW_KEY ?? '';
    const provided = request.header('x-dev-api-key') ?? '';
    if (key.length < 24 || provided.length !== key.length ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(key))) {
      throw new ForbiddenException('Invalid development preview key');
    }
    return true;
  }
}
