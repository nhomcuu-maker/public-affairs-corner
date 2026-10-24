import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { WorkflowService } from './workflow.service';
import { EvidenceIntakeService } from './evidence-intake.service';

function getToken(req: Request): string {
  const key = 'gds_session=';
  return (req.headers.cookie ?? '').split(';').map(x => x.trim())
    .find(x => x.startsWith(key))?.slice(key.length) ?? '';
}
function checkSameOrigin(req: Request): void {
  const origin = req.header('origin');
  const site = req.header('sec-fetch-site');
  if (site === 'cross-site') throw new ForbiddenException('Không chấp nhận yêu cầu từ website khác');
  if (!origin) {
    if (site !== 'same-origin') throw new ForbiddenException('Thiếu nguồn yêu cầu hợp lệ');
    return;
  }
  try {
    const url = new URL(origin);
    if (url.host !== req.header('host') || !['http:','https:'].includes(url.protocol)) {
      throw new Error('Origin không hợp lệ');
    }
  } catch { throw new ForbiddenException('Nguồn yêu cầu không hợp lệ'); }
}
function noCache(res: Response) { res.setHeader('Cache-Control', 'no-store'); }

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService,
              private readonly workflow: WorkflowService,
              private readonly auth: AuthService,
              private readonly evidence: EvidenceIntakeService) {}

  @Get('overview')
  overview(@Res({passthrough:true}) res: Response) {
    noCache(res); return this.admin.overview();
  }
  @Get('content')
  list(@Query() query: {domain?:string;status?:string;q?:string;page?:string},
       @Res({passthrough:true}) res: Response) {
    noCache(res); return this.admin.list(query);
  }
  @Get('content/:versionId')
  detail(@Param('versionId') id: string, @Res({passthrough:true}) res: Response) {
    noCache(res); return this.admin.detail(id);
  }
  @Get('content/:versionId/evidence-candidates')
  evidenceCandidates(@Param('versionId') id: string, @Res({passthrough:true}) res: Response) {
    noCache(res); return this.evidence.candidates(id);
  }
  @Post('content/:versionId/evidence-attach')
  async evidenceAttach(@Param('versionId') id: string, @Body() body: Record<string,unknown>,
                       @Req() req: Request, @Res({passthrough:true}) res: Response) {
    checkSameOrigin(req); noCache(res);
    return this.evidence.attach(id,await this.auth.profile(getToken(req)),body ?? {});
  }
  @Post('content/:versionId/evidence-verify')
  async evidenceVerify(@Param('versionId') id: string, @Body() body: Record<string,unknown>,
                       @Req() req: Request, @Res({passthrough:true}) res: Response) {
    checkSameOrigin(req); noCache(res);
    return this.evidence.verify(id,await this.auth.profile(getToken(req)),body ?? {});
  }
  @Put('content/:versionId/draft')
  async edit(@Param('versionId') id: string, @Body() body: Record<string,unknown>,
             @Req() req:Request, @Res({passthrough:true}) res:Response) {
    checkSameOrigin(req); noCache(res);
    return this.workflow.saveDraft(id,await this.auth.profile(getToken(req)), body ?? {});
  }
  @Post('content/:versionId/submit')
  async submit(@Param('versionId') id:string,@Body() body:Record<string,unknown>,
               @Req() req:Request,@Res({passthrough:true}) res:Response) {
    checkSameOrigin(req); noCache(res);
    return this.workflow.submit(id,await this.auth.profile(getToken(req)),body??{});
  }
  @Post('content/:versionId/reject')
  async reject(@Param('versionId') id:string,@Body() body:Record<string,unknown>,
               @Req() req:Request,@Res({passthrough:true}) res:Response) {
    checkSameOrigin(req); noCache(res);
    return this.workflow.reject(id,await this.auth.profile(getToken(req)),body??{});
  }
  @Post('content/:versionId/approve')
  async approve(@Param('versionId') id:string,@Body() body:Record<string,unknown>,
                @Req() req:Request,@Res({passthrough:true}) res:Response) {
    checkSameOrigin(req); noCache(res);
    return this.workflow.approve(id,await this.auth.profile(getToken(req)),body??{});
  }
  @Post('content/:versionId/publish')
  async publish(@Param('versionId') id:string,@Body() body:Record<string,unknown>,
                @Req() req:Request,@Res({passthrough:true}) res:Response) {
    checkSameOrigin(req); noCache(res);
    return this.workflow.publish(id,await this.auth.profile(getToken(req)),body??{});
  }
}
