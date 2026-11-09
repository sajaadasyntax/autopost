import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  const config = app.get(AppConfigService);
  app.enableCors({ origin: config.env.studioOrigin, credentials: true });
  await app.listen(config.env.port, '0.0.0.0');
  Logger.log(`Listening on ${config.env.port}`, 'Bootstrap');
}

void bootstrap();
