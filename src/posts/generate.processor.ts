import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConversationState, PostStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { isFinalAttempt, isPermanent, publicError } from '../common/errors';
import { ContentService } from '../content/content.service';
import { formatPostText } from '../content/format-copy';
import { DesignService } from '../design/design.service';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATE_POST_QUEUE } from '../queue/queue.names';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PipelinePost, PostsService } from './posts.service';

export type GenerateJobData = { postId: string; revision?: string };

@Processor(GENERATE_POST_QUEUE, { concurrency: 2, lockDuration: 300_000 })
export class GenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerateProcessor.name);

  constructor(
    private readonly posts: PostsService,
    private readonly content: ContentService,
    private readonly design: DesignService,
    private readonly whatsapp: WhatsappService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<GenerateJobData>): Promise<void> {
    try {
      await this.run(job.data);
    } catch (error) {
      if (isPermanent(error)) {
        await this.fail(job.data.postId, error);
        return;
      }
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerateJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalAttempt(job.attemptsMade, job.opts.attempts ?? 1)) {
      return;
    }
    await this.fail(job.data.postId, error);
  }

  private async run(data: GenerateJobData): Promise<void> {
    let post = await this.posts.findForPipeline(data.postId);
    if (!post || this.isClosed(post.status)) {
      return;
    }

    if (post.status === PostStatus.generating) {
      const filled = await this.fill(post, data.revision);
      if (!filled) {
        return;
      }
      post = filled;
      const drafted = await this.posts.markDraft(post.id);
      if (!drafted) {
        return;
      }
    } else if (post.status !== PostStatus.draft) {
      return;
    }

    await this.prisma.conversation.update({
      where: { userId: post.userId },
      data: { state: ConversationState.awaiting_approval, activePostId: post.id },
    });

    const latest = await this.posts.findById(post.id);
    if (!latest || latest.previewSent || latest.status !== PostStatus.draft) {
      return;
    }
    if (!post.caption || !post.cta) {
      return;
    }

    await this.whatsapp.sendDraftPreview({
      to: post.user.phone,
      postId: post.id,
      body: formatPostText({ caption: post.caption, hashtags: post.hashtags, cta: post.cta }),
      imageUrl: post.imageUrl,
    });
    await this.posts.markPreviewSent(post.id);
  }

  private async fill(post: PipelinePost, revision?: string): Promise<PipelinePost | null> {
    let current = post;
    if (!current.caption || !current.headline || !current.cta) {
      const copy = await this.content.generate({
        name: current.brand.name,
        tone: current.brand.tone,
        audience: current.brand.audience,
        brief: current.brief,
        revision,
      });
      if (!(await this.stillGenerating(current.id))) {
        return null;
      }
      await this.posts.saveCopy(current.id, copy);
      current = { ...current, ...copy };
    }

    if (!current.imageUrl) {
      if (!(await this.stillGenerating(current.id))) {
        return null;
      }
      const fields = {
        postId: current.id,
        headline: current.headline ?? '',
        caption: current.caption ?? '',
        cta: current.cta ?? '',
      };
      const image = (await this.design.isConfigured())
        ? await this.design.createImage({ ...fields, templateId: current.brand.canvaBrandTemplateId })
        : await this.design.createLocalPreview(fields);
      if (image) {
        if (!(await this.stillGenerating(current.id))) {
          return null;
        }
        await this.posts.saveDesign(current.id, image);
        current = { ...current, canvaDesignId: image.designId, imageUrl: image.imageUrl };
      }
    }
    return current;
  }

  private async stillGenerating(postId: string): Promise<boolean> {
    const post = await this.posts.findById(postId);
    return post?.status === PostStatus.generating;
  }

  private isClosed(status: PostStatus): boolean {
    return status === PostStatus.cancelled || status === PostStatus.failed || status === PostStatus.published;
  }

  private async fail(postId: string, error: unknown): Promise<void> {
    const post = await this.posts.findForPipeline(postId);
    if (!post || post.status === PostStatus.cancelled || post.status === PostStatus.published) {
      return;
    }
    await this.posts.markFailed(postId, publicError(error));
    const conversation = await this.prisma.conversation.findUnique({ where: { userId: post.userId } });
    if (conversation?.activePostId === post.id) {
      await this.prisma.conversation.update({
        where: { userId: post.userId },
        data: { state: ConversationState.idle, activePostId: null },
      });
    }
    try {
      await this.whatsapp.sendText(post.user.phone, `Couldn't finish that draft. ${publicError(error)}`);
    } catch {
      this.logger.error(`Could not report a draft failure for ${postId}`);
    }
  }
}
