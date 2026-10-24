import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { WorkflowService } from './workflow.service';
import { EvidenceIntakeService } from './evidence-intake.service';
import { OfficialFeedController } from './official-feed.controller';
import { OfficialFeedService } from './official-feed.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, OfficialFeedController],
  providers: [AdminGuard, AdminService, WorkflowService, OfficialFeedService, EvidenceIntakeService],
})
export class AdminModule {}
