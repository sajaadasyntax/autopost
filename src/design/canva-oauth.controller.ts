import { BadRequestException, Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { publicError } from '../common/errors';
import { AdminKeyGuard } from '../auth/admin-key.guard';
import { CanvaService } from './canva.service';

@Controller('integrations/canva')
export class CanvaOAuthController {
  constructor(private readonly canva: CanvaService) {}

  @Get()
  @UseGuards(AdminKeyGuard)
  start(@Res() res: Response): void {
    res.redirect(this.canva.buildAuthorizeUrl());
  }

  @Get('callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string): Promise<string> {
    if (error) {
      throw new BadRequestException(`Canva authorization failed: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Canva did not return a code.');
    }
    try {
      await this.canva.exchangeCode(code, state);
    } catch (caught) {
      throw new BadRequestException(publicError(caught));
    }
    return 'Canva connected. You can close this tab.';
  }

  @Get('dataset')
  @UseGuards(AdminKeyGuard)
  dataset(): Promise<unknown> {
    return this.canva.getTemplateDataset();
  }
}
