import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis | null;

  constructor(config: AppConfigService) {
    this.client = config.env.redisUrl
      ? new Redis(config.env.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
      : null;
  }

  async ping(): Promise<string> {
    if (!this.client) {
      return 'LOCAL';
    }
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}
