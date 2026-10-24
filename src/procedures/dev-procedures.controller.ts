import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { DevPreviewGuard } from './dev-preview.guard';

// Deliberately NOT a production admin API. Auth + RBAC comes in next stage.
@Controller('api/dev/procedures')
@UseGuards(DevPreviewGuard)
export class DevProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @Get(':businessCode')
  async detail(@Param('businessCode') code: string): Promise<unknown> {
    return this.procedures.getDetail(code, false);
  }
}
