import { Logger, Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { BrandsModule } from './brands/brands.module';
import { ContentModule } from './content/content.module';
import { ConversationModule } from './conversation/conversation.module';
import { CryptoModule } from './crypto/crypto.module';
import { DesignModule } from './design/design.module';
import { DevModule } from './dev/dev.module';
import { OutboxModule } from './dev/outbox.module';
import { HealthModule } from './health/health.module';
import { LegalModule } from './legal/legal.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublishingModule } from './publishing/publishing.module';
import { LocalWorkers } from './queue/local-workers';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    AppConfigModule,
    CryptoModule,
    PrismaModule,
    RedisModule,
    OutboxModule,
    QueueModule.register(),
    BrandsModule,
    PostsModule,
    WhatsappModule,
    ContentModule,
    DesignModule,
    PublishingModule,
    ConversationModule,
    DevModule,
    HealthModule,
    LegalModule,
  ],
  providers: [LocalWorkers],
})
export class AppModule {
  constructor(config: AppConfigService) {
    if (config.env.allowlist.size === 0) {
      Logger.warn('ALLOWLIST_PHONES is empty. Every sender will be refused.', 'Bootstrap');
    }
  }
}
