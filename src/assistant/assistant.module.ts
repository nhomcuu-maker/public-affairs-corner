import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { AdminGuard } from '../admin/admin.guard';
import { PublicAssistantController, StaffAssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { FeedbackModule } from '../feedback/feedback.module';
@Module({imports:[SearchModule,AuthModule,FeedbackModule],controllers:[PublicAssistantController,StaffAssistantController],providers:[AssistantService,AdminGuard]})
export class AssistantModule {}
