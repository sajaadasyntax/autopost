import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { GENERATE_JOBS, INCOMING_JOBS, JobPort, PUBLISH_JOBS } from './job.port';
import { LocalQueueRegistry } from './local-queue';
import { GENERATE_POST_QUEUE, INCOMING_QUEUE, PUBLISH_POST_QUEUE } from './queue.names';

@Global()
@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const redisUrl = process.env.REDIS_URL?.trim() ?? '';
    if (redisUrl) {
      return {
        module: QueueModule,
        global: true,
        imports: [
          BullModule.forRoot({
            connection: { url: redisUrl, maxRetriesPerRequest: null },
          }),
          BullModule.registerQueue(
            { name: INCOMING_QUEUE },
            { name: GENERATE_POST_QUEUE },
            { name: PUBLISH_POST_QUEUE },
          ),
        ],
        providers: [
          queueProvider(INCOMING_JOBS, INCOMING_QUEUE),
          queueProvider(GENERATE_JOBS, GENERATE_POST_QUEUE),
          queueProvider(PUBLISH_JOBS, PUBLISH_POST_QUEUE),
        ],
        exports: [INCOMING_JOBS, GENERATE_JOBS, PUBLISH_JOBS],
      };
    }

    const registry = new LocalQueueRegistry();
    return {
      module: QueueModule,
      global: true,
      providers: [
        { provide: LocalQueueRegistry, useValue: registry },
        { provide: INCOMING_JOBS, useValue: registry.port(INCOMING_QUEUE) },
        { provide: GENERATE_JOBS, useValue: registry.port(GENERATE_POST_QUEUE) },
        { provide: PUBLISH_JOBS, useValue: registry.port(PUBLISH_POST_QUEUE) },
      ],
      exports: [LocalQueueRegistry, INCOMING_JOBS, GENERATE_JOBS, PUBLISH_JOBS],
    };
  }
}

function queueProvider(token: symbol, name: string) {
  return {
    provide: token,
    inject: [getQueueToken(name)],
    useFactory: (queue: Queue): JobPort => ({
      add: (jobName, data, opts) => queue.add(jobName, data, opts).then(() => undefined),
    }),
  };
}
