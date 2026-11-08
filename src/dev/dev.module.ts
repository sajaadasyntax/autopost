import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { DevController } from './dev.controller';

@Module({
  imports: [ConversationModule],
  controllers: [DevController],
})
export class DevModule {}
