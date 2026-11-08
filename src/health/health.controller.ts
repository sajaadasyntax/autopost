import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async health(): Promise<{ status: 'ok'; database: 'up'; queue: 'local' | 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', database: 'down' });
    }
    try {
      const queue = await this.redis.ping();
      if (queue === 'LOCAL') {
        return { status: 'ok', database: 'up', queue: 'local' };
      }
      if (queue !== 'PONG') {
        throw new Error('Redis did not answer PONG');
      }
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', queue: 'down' });
    }
    return { status: 'ok', database: 'up', queue: 'up' };
  }
}
