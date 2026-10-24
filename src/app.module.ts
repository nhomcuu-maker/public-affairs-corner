import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { DomainsModule } from './domains/domains.module';
import { ProceduresModule } from './procedures/procedures.module';
import { ContentModule } from './content/content.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { MvpModule } from './mvp/mvp.module';
import { SearchModule } from './search/search.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    HealthModule,
    DomainsModule,
    ProceduresModule,
    ContentModule,
    AuthModule,
    AdminModule,
    MvpModule,
    SearchModule,
    AssistantModule,
  ],
})
export class AppModule {}
