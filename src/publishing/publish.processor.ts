import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConversationState, PostStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { isFinalAttempt, isPermanent, publicError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { PUBLISH_POST_QUEUE } from '../queue/queue.names';
import { COPY } from '../whatsapp/copy';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { nextPublishStep, publishFailureText } from './publish-step';
import { PublishingService } from './publishing.service';

export type PublishJobData = { postId: string };

@Processor(PUBLISH_POST_QUEUE, { concurrency: 1, lockDuration: 180_000 })
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private readonly posts: PostsService,
    private readonly publishing: PublishingService,
    private readonly whatsapp: WhatsappService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<void> {
    const post = await this.posts.findForPipeline(job.data.postId);
    if (!post) {
      return;
    }
    const step = nextPublishStep(post);
    if (step === 'stop') {
      return;
    }
    if (step === 'confirm') {
      if (post.status !== PostStatus.published) {
        await this.posts.markPublished(post.id);
        await this.idle(post.userId, post.id);
      }
      await this.notify(post.user.phone);
      return;
    }
    if (step === 'claim') {
      const claimed = await this.posts.markPublishing(post.id);
      if (!claimed) {
        return;
      }
    }

    try {
      await this.publishing.publish(post.id);
      const published = await this.posts.markPublished(post.id);
      if (published) {
        await this.idle(post.userId, post.id);
      }
      await this.notify(post.user.phone);
    } catch (error) {
      if (isPermanent(error)) {
        await this.fail(post.id, error);
        return;
      }
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PublishJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalAttempt(job.attemptsMade, job.opts.attempts ?? 1)) {
      return;
    }
    await this.fail(job.data.postId, error);
  }

  private async fail(postId: string, error: unknown): Promise<void> {
    const message = publicError(error);
    await this.posts.markFailed(postId, message);
    const post = await this.posts.findForPipeline(postId);
    if (!post) {
      return;
    }
    await this.idle(post.userId, post.id);
    try {
      await this.whatsapp.sendText(post.user.phone, publishFailureText(post, message));
    } catch {
      this.logger.error(`Could not report a publish failure for ${postId}`);
    }
  }

  private async idle(userId: string, postId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({ where: { userId } });
    if (conversation && conversation.activePostId !== postId) {
      return;
    }
    await this.prisma.conversation.update({
      where: { userId },
      data: { state: ConversationState.idle, activePostId: null },
    });
  }

  private async notify(phone: string): Promise<void> {
    try {
      await this.whatsapp.sendText(phone, COPY.published);
    } catch {
      this.logger.error('Published, but the WhatsApp confirmation failed');
    }
  }
}
