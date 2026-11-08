import { Controller, Get, Header } from '@nestjs/common';
import { dataDeletionPage } from './data-deletion.page';

@Controller('data-deletion')
export class DataDeletionController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    return dataDeletionPage();
  }
}
