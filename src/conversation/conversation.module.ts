import { Module } from '@nestjs/common';
import { BrandsModule } from '../brands/brands.module';
import { PostsModule } from '../posts/posts.module';
import { StudioModule } from '../studio/studio.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversationService } from './conversation.service';
import { IncomingProcessor } from './incoming.processor';

@Module({
  imports: [PostsModule, BrandsModule, WhatsappModule, StudioModule],
  providers: [ConversationService, IncomingProcessor],
  exports: [ConversationService, IncomingProcessor],
})
export class ConversationModule {}
