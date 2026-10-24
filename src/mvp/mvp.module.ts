import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../admin/admin.guard';
import { MvpController } from './mvp.controller';
import { MvpService } from './mvp.service';

@Module({
  imports: [AuthModule],
  controllers: [MvpController],
  providers: [MvpService, AdminGuard],
})
export class MvpModule {}
