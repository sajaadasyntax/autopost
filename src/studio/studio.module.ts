import { Module } from '@nestjs/common';
import { DesignModule } from '../design/design.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AccountsService } from './accounts.service';
import { BrandPreviewService } from './brand-preview.service';
import { FacebookOAuthService } from './facebook-oauth.service';
import { StudioAuthService } from './studio-auth.service';
import { StudioController } from './studio.controller';
import { StudioSessionGuard } from './studio-session.guard';
import { TemplatesService } from './templates.service';

@Module({
  imports: [DesignModule, WhatsappModule],
  controllers: [StudioController],
  providers: [StudioAuthService, StudioSessionGuard, AccountsService, FacebookOAuthService, TemplatesService, BrandPreviewService],
  exports: [StudioAuthService, AccountsService],
})
export class StudioModule {}
