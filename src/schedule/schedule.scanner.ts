import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLISH_JOBS, JobPort } from '../queue/job.port';
import { jobOptions } from '../queue/queue.names';

@Injectable()
export class ScheduleScanner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleScanner.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUBLISH_JOBS) private readonly publishQueue: JobPort,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(now = new Date()): Promise<void> {
    const due = await this.prisma.post.findMany({
      where: { status: PostStatus.scheduled, scheduledAt: { lte: now } },
      select: { id: true },
      take: 20,
    });
    for (const post of due) {
      const claimed = await this.prisma.post.updateMany({
        where: { id: post.id, status: PostStatus.scheduled, scheduledAt: { lte: now } },
        data: { status: PostStatus.publishing },
      });
      if (claimed.count !== 1) {
        continue;
      }
      await this.publishQueue.add('publish', { postId: post.id }, jobOptions(`publish:${post.id}`, 5000));
      this.logger.log(`Publishing scheduled ${post.id}`);
    }
  }
}
