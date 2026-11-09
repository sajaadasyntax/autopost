import { Controller, Get, Param, Res } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { MediaStorageService } from './media-storage.service';

@Controller('media')
export class MediaController {
  constructor(private readonly storage: MediaStorageService) {}

  @Get(':name')
  serve(@Param('name') name: string, @Res() res: Response): void {
    const file = this.storage.localPath(name);
    if (!existsSync(file)) {
      res.status(404).send('Not found');
      return;
    }
    res.type(name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : 'image/jpeg');
    createReadStream(file).pipe(res);
  }
}
