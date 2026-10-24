import { Controller, Get } from '@nestjs/common';
import { getProvinceCatalog } from './provinces.catalog';

@Controller('api/locations')
export class ProvincesController {
  @Get('provinces')
  list() { return getProvinceCatalog(); }
}
