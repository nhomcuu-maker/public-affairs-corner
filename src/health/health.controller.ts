import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async health(): Promise<{ ok: true; db: 'connected' }> {
    await this.database.request().query('SELECT 1 AS ok');
    return { ok: true, db: 'connected' };
  }
}
