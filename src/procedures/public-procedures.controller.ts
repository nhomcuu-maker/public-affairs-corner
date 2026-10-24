import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProceduresService } from './procedures.service';

@Controller('api/procedures')
export class PublicProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @Get()
  async list(@Query('provinceCode') provinceCode?: string): Promise<unknown[]> {
    return this.procedures.listPublished(provinceCode);
  }

  @Get(':businessCode')
  async detail(@Param('businessCode') code: string, @Query('provinceCode') provinceCode?: string): Promise<unknown> {
    return this.procedures.getDetail(code, true, provinceCode);
  }
}
