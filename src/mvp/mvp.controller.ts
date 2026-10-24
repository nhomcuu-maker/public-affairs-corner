import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { MvpService } from './mvp.service';

// Internal-only MVP data preview. All routes require a valid staff session.
@Controller('api/admin/mvp')
@UseGuards(AdminGuard)
export class MvpController {
  constructor(private readonly service: MvpService) {}

  @Get()
  async overview(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.overview();
  }

  @Get('item/:code')
  async detail(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.detail(code);
  }
}
