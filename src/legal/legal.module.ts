import { Module } from '@nestjs/common';
import { DataDeletionController } from './data-deletion.controller';

@Module({
  controllers: [DataDeletionController],
})
export class LegalModule {}
