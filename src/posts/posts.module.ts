import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { DesignModule } from '../design/design.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { GenerateProcessor } from './generate.processor';
import { PostsService } from './posts.service';

@Module({
  imports: [ContentModule, DesignModule, WhatsappModule],
  providers: [PostsService, GenerateProcessor],
  exports: [PostsService, GenerateProcessor],
})
export class PostsModule {}
