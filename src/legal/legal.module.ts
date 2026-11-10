import { Module } from '@nestjs/common';
import { DataDeletionController } from './data-deletion.controller';
import { PolicyController } from './policy.controller';

@Module({
  controllers: [DataDeletionController, PolicyController],
})
export class LegalModule {}
