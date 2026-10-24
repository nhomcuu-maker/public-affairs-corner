import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from './admin.guard';
import { OfficialFeedService } from './official-feed.service';

function privateResponse(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

@Controller('api/admin/official-feed')
@UseGuards(AdminGuard)
export class OfficialFeedController {
  constructor(private readonly feed: OfficialFeedService) {}

  @Get('overview')
  overview(@Res({ passthrough: true }) res: Response) {
    privateResponse(res);
    return this.feed.overview();
  }

  @Get('entries')
  entries(@Query() params: { page?: string; size?: string; q?: string },
          @Res({ passthrough: true }) res: Response) {
    privateResponse(res);
    return this.feed.list(params);
  }

  @Get('entries/:id/history')
  history(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    privateResponse(res);
    return this.feed.history(id);
  }
}
