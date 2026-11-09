import { Module } from '@nestjs/common';
import { ScheduleScanner } from './schedule.scanner';

@Module({
  providers: [ScheduleScanner],
})
export class ScheduleModule {}
