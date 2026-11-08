import { Module } from '@nestjs/common';
import { CanvaOAuthController } from './canva-oauth.controller';
import { CanvaService } from './canva.service';
import { DesignService } from './design.service';
import { MediaController } from './media.controller';
import { MediaStorageService } from './media-storage.service';

@Module({
  controllers: [CanvaOAuthController, MediaController],
  providers: [CanvaService, MediaStorageService, DesignService],
  exports: [DesignService],
})
export class DesignModule {}
