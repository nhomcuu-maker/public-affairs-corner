import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';

// Deliberately enforced on each protected API request, not by browser visibility.
const STAFF_ROLES = new Set(['author', 'editor', 'reviewer', 'publisher', 'admin']);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.headers.cookie ?? '')
      .split(';').map(value => value.trim())
      .find(value => value.startsWith('gds_session='))?.slice('gds_session='.length) ?? '';
    // profile() checks session expiry, revocation, account status, and roles from SQL.
    const actor = await this.auth.profile(token); // 401 for unauthenticated sessions
    if (!actor.roles.some(role => STAFF_ROLES.has(role))) {
      throw new ForbiddenException('Tài khoản không có quyền truy cập khu vực biên tập');
    }
    return true;
  }
}
