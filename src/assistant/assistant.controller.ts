import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request,Response } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { AssistantService } from './assistant.service';
import { FeedbackService } from '../feedback/feedback.service';

function secure(req:Request,res:Response) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex,nofollow');
  const origin=req.header('origin');
  if(req.header('sec-fetch-site')==='cross-site') throw new ForbiddenException('Cross-site request denied');
  if(origin) {
    let expected:string;
    try {expected=new URL(origin).host;}catch {throw new ForbiddenException('Origin denied');}
    if(expected!==req.header('host')) throw new ForbiddenException('Origin denied');
  }
}
const counters=new Map<string,{num:number;expires:number}>();
function throttle(req:Request) {
  const now=Date.now(), key=req.socket.remoteAddress||'local';
  if(counters.size>2000) for(const [k,v] of counters) if(v.expires<now) counters.delete(k);
  const current=counters.get(key);
  if(!current||current.expires<now) counters.set(key,{num:1,expires:now+60000});
  else {current.num++; if(current.num>12) throw new BadRequestException('Bạn gửi quá nhiều câu hỏi, vui lòng thử lại sau một phút.');}
}
function valid(body:unknown):Record<string,unknown> {
  if(!body||typeof body!=='object'||Array.isArray(body)) throw new BadRequestException('Dữ liệu gửi lên không hợp lệ.');
  const d=body as Record<string,unknown>;
  if(typeof d.question!=='string'||d.question.trim().length<5||d.question.trim().length>240)
    throw new BadRequestException('Câu hỏi cần từ 5 đến 240 ký tự.');
  if(d.history!==undefined && (!Array.isArray(d.history) || d.history.length>3 || !d.history.every((x:unknown)=>typeof x==='string' && x.length>=5 && x.length<=240)))
    throw new BadRequestException('Lịch sử trao đổi không hợp lệ.');
  if(d.domain!==undefined&&!['ALL','LEGAL','ADMIN','SCAM'].includes(String(d.domain)))
    throw new BadRequestException('Lĩnh vực không hợp lệ.');
  return d;
}
@Controller('api/assistant')
export class PublicAssistantController {
  constructor(private readonly assistant:AssistantService, private readonly feedback:FeedbackService) {}
  @Get('status')
  status(@Res({passthrough:true}) res:Response) {
    res.setHeader('Cache-Control','no-store');
    // No secrets returned. This reports CONFIGURATION only, not a live-provider success.
    const local = process.env.AI_PROVIDER?.toLowerCase() === 'ollama';
    const configured = Boolean(process.env.AI_MODEL?.trim() && (local || process.env.AI_API_KEY?.trim()));
    return { configured, provider: local ? 'ollama-local' : 'remote',
      model: configured ? process.env.AI_MODEL : null,
      staffDraftPreview: process.env.AI_ALLOW_STAFF_DRAFTS === 'true',
      publicPolicy: 'PUBLISHED_VERIFIED_ONLY',
      note: 'Trang thai cau hinh; de xac nhan AI thuc su tra loi, goi POST /api/assistant/ask.' };
  }
  @Post('ask')
  @HttpCode(200)
  async ask(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response) {
    secure(req,res);throttle(req);const result=await this.assistant.ask(valid(body),false);
    return {...result,feedbackReceipt:this.feedback.issue(result)};
  }
}
@Controller('api/admin/assistant')
@UseGuards(AdminGuard)
export class StaffAssistantController {
  constructor(private readonly assistant:AssistantService, private readonly feedback:FeedbackService) {}
  @Post('ask')
  @HttpCode(200)
  async ask(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response) {
    secure(req,res);throttle(req);const result=await this.assistant.ask(valid(body),true);
    return {...result,feedbackReceipt:this.feedback.issue(result)};
  }
}
