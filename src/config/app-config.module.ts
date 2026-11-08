import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { loadConfig } from './load-config';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(loadConfig(process.env)),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
