import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { IncomingProcessor } from '../conversation/incoming.processor';
import { GenerateProcessor } from '../posts/generate.processor';
import { PublishProcessor } from '../publishing/publish.processor';
import { GENERATE_POST_QUEUE, INCOMING_QUEUE, PUBLISH_POST_QUEUE } from './queue.names';
import { LocalJob } from './job.port';
import { LocalQueueRegistry } from './local-queue';

@Injectable()
export class LocalWorkers implements OnModuleInit {
  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly registry: LocalQueueRegistry,
    private readonly incoming: IncomingProcessor,
    private readonly generate: GenerateProcessor,
    private readonly publish: PublishProcessor,
  ) {}

  onModuleInit(): void {
    if (this.config.env.queueDriver !== 'local' || !this.registry) {
      return;
    }
    this.registry.bind(INCOMING_QUEUE, {
      run: (job) => this.incoming.process(asJob(job)),
    });
    this.registry.bind(GENERATE_POST_QUEUE, {
      run: (job) => this.generate.process(asJob(job)),
      onFailed: (job, error) => this.generate.onFailed(asJob(job), error),
    });
    this.registry.bind(PUBLISH_POST_QUEUE, {
      run: (job) => this.publish.process(asJob(job)),
      onFailed: (job, error) => this.publish.onFailed(asJob(job), error),
    });
  }
}

function asJob<T>(job: LocalJob): T {
  return job as T;
}
