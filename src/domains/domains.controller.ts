import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('api/domains')
export class DomainsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(): Promise<unknown[]> {
    const result = await this.database.request().query(`
      SELECT id, code, name
      FROM dbo.[domain]
      WHERE is_active = 1 AND code IN (N'LEGAL', N'ADMIN', N'SCAM')
      ORDER BY id;
    `);
    return result.recordset;
  }
}
