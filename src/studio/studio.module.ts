import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { FacebookOAuthService } from './facebook-oauth.service';
import { StudioAuthService } from './studio-auth.service';
import { StudioController } from './studio.controller';
import { StudioSessionGuard } from './studio-session.guard';

@Module({
  controllers: [StudioController],
  providers: [StudioAuthService, StudioSessionGuard, AccountsService, FacebookOAuthService],
  exports: [StudioAuthService, AccountsService],
})
export class StudioModule {}
