import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MetaService } from './meta.service';
import { PublishProcessor } from './publish.processor';
import { PublishingService } from './publishing.service';

@Module({
  imports: [PostsModule, WhatsappModule],
  providers: [MetaService, PublishingService, PublishProcessor],
  exports: [PublishProcessor],
})
export class PublishingModule {}
