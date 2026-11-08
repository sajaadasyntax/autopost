import { Module } from '@nestjs/common';
import { WebhookIngressService } from './webhook-ingress.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, WebhookIngressService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
