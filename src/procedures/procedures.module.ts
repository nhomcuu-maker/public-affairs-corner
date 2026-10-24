import { Module } from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { PublicProceduresController } from './public-procedures.controller';
import { DevProceduresController } from './dev-procedures.controller';
import { DevPreviewGuard } from './dev-preview.guard';
import { ProvincesController } from './provinces.controller';

@Module({
  providers: [ProceduresService, DevPreviewGuard],
  controllers: [PublicProceduresController, DevProceduresController, ProvincesController],
})
export class ProceduresModule {}
