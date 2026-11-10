import { Controller, Get, Header } from '@nestjs/common';
import { privacyPage } from './privacy.page';
import { termsPage } from './terms.page';

@Controller()
export class PolicyController {
  @Get('privacy/whatsapp')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacy(): string {
    return privacyPage();
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms(): string {
    return termsPage();
  }
}
