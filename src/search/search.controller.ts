import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { SearchService } from './search.service';

const noCache = (res: Response) => res.setHeader('Cache-Control', 'no-store');

// No auth cookie required: ONLY fully published, currently valid and verified content.
@Controller('api/search')
export class PublicSearchController {
  constructor(private readonly service: SearchService) {}
  @Get()
  list(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    noCache(res);
    return this.service.search(query, false);
  }
}

// Staff-only; preview of non-published data never exposed by /api/search.
@Controller('api/admin/search')
@UseGuards(AdminGuard)
export class StaffSearchController {
  constructor(private readonly service: SearchService) {}
  @Get()
  list(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    noCache(res);
    return this.service.search(query, true);
  }
}
