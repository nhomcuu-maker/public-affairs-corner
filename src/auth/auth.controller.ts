import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const COOKIE = 'gds_session';
const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
function sessionToken(req: Request): string {
  const header = req.headers.cookie ?? '';
  const raw = header.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  return raw ? raw.slice(COOKIE.length + 1) : '';
}
function requireSameOrigin(req: Request) {
  const origin = req.header('origin');
  const fetchSite = req.header('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new ForbiddenException('Cross-site request denied');
  if (!origin) return;
  try {
    const url = new URL(origin);
    if (url.host !== req.header('host') || !['http:', 'https:'].includes(url.protocol))
      throw new ForbiddenException('Origin denied');
  } catch { throw new ForbiddenException('Origin denied'); }
}
function forbidCaching(res: Response) { res.setHeader('Cache-Control','no-store'); }
function ipAddress(req: Request) { return req.socket.remoteAddress ?? 'unknown'; }

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: Record<string,unknown>, @Req() req: Request, @Res({passthrough:true}) res: Response) {
    requireSameOrigin(req); forbidCaching(res);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    return this.auth.register(body, ipAddress(req));
  }

  @Post('login')
  async login(@Body() body: Record<string,unknown>, @Req() req: Request, @Res({passthrough:true}) res: Response) {
    requireSameOrigin(req); forbidCaching(res);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const data = await this.auth.login(body, ipAddress(req));
    res.cookie(COOKIE,data.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:MS_7_DAYS});
    return { ok:true,user:data.user };
  }

  @Get('me')
  async me(@Req() req:Request, @Res({passthrough:true}) res:Response) {
    forbidCaching(res);
    return { user:await this.auth.profile(sessionToken(req)) };
  }

  @Post('logout')
  async logout(@Req() req:Request,@Res({passthrough:true}) res:Response) {
    requireSameOrigin(req); forbidCaching(res);
    await this.auth.logout(sessionToken(req));
    res.clearCookie(COOKIE,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'});
    return { ok:true };
  }
}
