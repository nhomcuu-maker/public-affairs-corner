import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../admin/admin.guard';
import { FeedbackController, FeedbackAdminController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
@Module({imports:[AuthModule],controllers:[FeedbackController,FeedbackAdminController],providers:[FeedbackService,AdminGuard],exports:[FeedbackService]})
export class FeedbackModule {}
