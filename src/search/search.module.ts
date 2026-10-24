import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../admin/admin.guard';
import { PublicSearchController, StaffSearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicSearchController, StaffSearchController],
  providers: [SearchService, AdminGuard],
  exports: [SearchService],
})
export class SearchModule {}
