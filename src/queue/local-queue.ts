import { Injectable, Logger } from '@nestjs/common';
import { JobAddOptions, JobPort, LocalHandler, LocalJob } from './job.port';

@Injectable()
export class LocalQueueRegistry {
  private readonly logger = new Logger(LocalQueueRegistry.name);
  private readonly handlers = new Map<string, LocalHandler>();
  private readonly seen = new Set<string>();

  bind(queueName: string, handler: LocalHandler): void {
    this.handlers.set(queueName, handler);
  }

  port(queueName: string): JobPort {
    return {
      add: async (_name, data, opts) => {
        const jobId = opts?.jobId;
        if (jobId && this.seen.has(jobId)) {
          return;
        }
        if (jobId) {
          this.seen.add(jobId);
        }
        await this.run(queueName, data, opts);
      },
    };
  }

  private async run(queueName: string, data: unknown, opts?: JobAddOptions): Promise<void> {
    const handler = this.handlers.get(queueName);
    if (!handler) {
      throw new Error(`No local worker is registered for ${queueName}`);
    }
    const attempts = opts?.attempts ?? 1;
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const job: LocalJob = { data, attemptsMade: attempt, opts: { attempts } };
      try {
        await handler.run(job);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < attempts) {
          const delay = Math.min(opts?.backoff?.delay ?? 20, 250) * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    this.logger.error(`${queueName} failed after ${attempts} attempts`);
    if (lastError && handler.onFailed) {
      await handler.onFailed({ data, attemptsMade: attempts, opts: { attempts } }, lastError);
    }
  }
}
