import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request,Response } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { AuthService } from '../auth/auth.service';
import { FeedbackService } from './feedback.service';
const requests=new Map<string,{count:number;reset:number}>();
function security(req:Request,res:Response){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex,nofollow');
  const origin=req.header('origin');const site=req.header('sec-fetch-site');
  if(site==='cross-site')throw new ForbiddenException('Yêu cầu từ website khác không được chấp nhận.');
  if(origin){try{const url=new URL(origin);if(url.host!==req.header('host')||!['http:','https:'].includes(url.protocol))throw Error('bad');}
    catch{throw new ForbiddenException('Nguồn yêu cầu không hợp lệ.');}}
  else if(site!=='same-origin')throw new ForbiddenException('Cần gửi yêu cầu từ chính website.');
}
function limit(req:Request){
  const now=Date.now(),ip=req.socket.remoteAddress||'local';
  if(requests.size>2000)for(const [k,v] of requests)if(v.reset<now)requests.delete(k);
  let slot=requests.get(ip);if(!slot||slot.reset<now){slot={count:0,reset:now+60000};requests.set(ip,slot);}
  if(++slot.count>15)throw new BadRequestException('Vui lòng thử lại sau một phút.');
}
function token(req:Request){return (req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('gds_session='))?.slice(12)??'';}
@Controller('api/assistant')
export class FeedbackController {
  constructor(private readonly service:FeedbackService){}
  @Post('feedback')
  submit(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){security(req,res);limit(req);return this.service.submit(body);}
}
@Controller('api/admin/feedback')
@UseGuards(AdminGuard)
export class FeedbackAdminController {
  constructor(private readonly service:FeedbackService,private readonly auth:AuthService){}
  @Get()
  list(@Res({passthrough:true}) res:Response){res.setHeader('Cache-Control','no-store');return this.service.overview();}
  @Post(':id/review')
  async review(@Param('id') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){
    security(req,res);return this.service.markReviewed(id,await this.auth.profile(token(req)));
  }
}
