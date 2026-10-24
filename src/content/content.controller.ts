import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('api')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Get('categories') categories(@Query('domain') domain?: string) {
    return this.service.categories(domain);
  }

  @Get('content') content(@Query('domain') domain?: string, @Query('q') query?: string) {
    return this.service.list(domain, query);
  }

  @Get('content/:businessCode') detail(@Param('businessCode') businessCode: string) {
    return this.service.detail(businessCode);
  }
}
