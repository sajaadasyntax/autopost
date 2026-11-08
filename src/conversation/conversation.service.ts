import { unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversation, ConversationState, PostStatus, User } from '@prisma/client';
import { normalizePhone } from '../common/phones';
import { BrandsService } from '../brands/brands.service';
import { AppConfigService } from '../config/app-config.service';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATE_JOBS, JobPort, PUBLISH_JOBS } from '../queue/job.port';
import { jobOptions } from '../queue/queue.names';
import { COPY } from '../whatsapp/copy';
import { IncomingMessage, parseButtonId } from '../whatsapp/parse-webhook';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly brands: BrandsService,
    private readonly whatsapp: WhatsappService,
    private readonly config: AppConfigService,
    @Inject(GENERATE_JOBS) private readonly generateQueue: JobPort,
    @Inject(PUBLISH_JOBS) private readonly publishQueue: JobPort,
  ) {}

  async handle(message: IncomingMessage): Promise<void> {
    const phone = normalizePhone(message.from);
    await this.whatsapp.markRead(message.messageId);

    if (!this.config.env.allowlist.has(phone)) {
      await this.whatsapp.sendText(phone, COPY.refusal);
      return;
    }

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, name: message.name },
      update: message.name ? { name: message.name } : {},
    });
    const conversation = await this.prisma.conversation.upsert({
      where: { userId: user.id },
      create: { userId: user.id, state: ConversationState.idle },
      update: {},
    });

    if (message.kind === 'button' && message.buttonId) {
      await this.handleButton(user, conversation, message.buttonId);
      return;
    }
    if (message.kind !== 'text' || !message.text?.trim()) {
      await this.whatsapp.sendText(phone, COPY.needText);
      return;
    }
    await this.handleText(user, conversation, message);
  }

  private async handleText(user: User, conversation: Conversation, message: IncomingMessage): Promise<void> {
    const text = message.text!.trim();
    if (isDataDeletionRequest(text)) {
      await this.deleteAccount(user);
      await this.whatsapp.sendText(user.phone, COPY.deleted);
      return;
    }
    switch (conversation.state) {
      case ConversationState.idle:
        await this.startGeneration(user, message, text);
        return;
      case ConversationState.generating:
        await this.whatsapp.sendText(user.phone, COPY.stillWorking);
        return;
      case ConversationState.awaiting_approval:
        await this.whatsapp.sendText(user.phone, COPY.tapButtons);
        return;
      case ConversationState.awaiting_edit:
        await this.revise(user, conversation, message, text);
        return;
      default:
        return;
    }
  }

  private async startGeneration(user: User, message: IncomingMessage, brief: string): Promise<void> {
    const existing = await this.posts.findBySourceMessageId(message.messageId);
    if (existing) {
      if (existing.status === PostStatus.generating) {
        await this.whatsapp.sendText(user.phone, COPY.creating);
        await this.enqueueGenerate(existing.id, message.messageId);
      }
      return;
    }

    const brand = await this.brands.findFirst();
    if (!brand) {
      await this.whatsapp.sendText(user.phone, COPY.noBrand);
      return;
    }

    const post = await this.posts.createGenerating({
      userId: user.id,
      brandId: brand.id,
      brief,
      sourceMessageId: message.messageId,
    });
    await this.prisma.conversation.update({
      where: { userId: user.id },
      data: { state: ConversationState.generating, activePostId: post.id },
    });
    await this.whatsapp.sendText(user.phone, COPY.creating);
    await this.enqueueGenerate(post.id, message.messageId);
    this.logger.log(`Generating ${post.id}`);
  }

  private async revise(user: User, conversation: Conversation, message: IncomingMessage, revision: string): Promise<void> {
    if (!conversation.activePostId) {
      await this.idle(user.id);
      await this.whatsapp.sendText(user.phone, COPY.needText);
      return;
    }
    const post = await this.posts.findById(conversation.activePostId);
    if (!post || post.status === PostStatus.cancelled || post.status === PostStatus.published) {
      await this.idle(user.id);
      return;
    }
    if (post.revisionMessageId !== message.messageId) {
      await this.posts.beginRevision(post.id, message.messageId);
      await this.prisma.conversation.update({
        where: { userId: user.id },
        data: { state: ConversationState.generating },
      });
    }
    await this.whatsapp.sendText(user.phone, COPY.updating);
    await this.enqueueGenerate(post.id, message.messageId, revision);
  }

  private async handleButton(user: User, conversation: Conversation, buttonId: string): Promise<void> {
    const parsed = parseButtonId(buttonId);
    if (!parsed) {
      await this.whatsapp.sendText(user.phone, COPY.tapButtons);
      return;
    }
    if (parsed.postId !== conversation.activePostId) {
      await this.whatsapp.sendText(user.phone, COPY.stale);
      return;
    }

    if (parsed.action === 'approve') {
      await this.approve(user, parsed.postId);
      return;
    }
    if (parsed.action === 'edit') {
      const post = await this.posts.findById(parsed.postId);
      if (!post || post.status !== PostStatus.draft) {
        return;
      }
      await this.prisma.conversation.update({
        where: { userId: user.id },
        data: { state: ConversationState.awaiting_edit },
      });
      await this.whatsapp.sendText(user.phone, COPY.editPrompt);
      return;
    }

    const cancelled = await this.posts.cancelIfOpen(parsed.postId);
    if (cancelled) {
      await this.idle(user.id);
      await this.whatsapp.sendText(user.phone, COPY.cancelled);
    }
  }

  private async approve(user: User, postId: string): Promise<void> {
    const post = await this.posts.findById(postId);
    if (!post) {
      return;
    }
    if (post.status === PostStatus.generating) {
      await this.whatsapp.sendText(user.phone, COPY.stillUpdating);
      return;
    }
    if (post.status === PostStatus.published || post.status === PostStatus.publishing) {
      return;
    }
    const claimed = await this.posts.markApproved(postId);
    if (claimed) {
      await this.whatsapp.sendText(user.phone, COPY.publishing);
    }
    if (claimed || post.status === PostStatus.approved) {
      await this.publishQueue.add('publish', { postId }, jobOptions(`publish:${postId}`, 5000));
    }
  }

  private enqueueGenerate(postId: string, messageId: string, revision?: string): Promise<unknown> {
    return this.generateQueue.add('generate', { postId, revision }, jobOptions(`generate:${messageId}`, 5000));
  }

  private idle(userId: string) {
    return this.prisma.conversation.update({
      where: { userId },
      data: { state: ConversationState.idle, activePostId: null },
    });
  }

  private async deleteAccount(user: User): Promise<void> {
    const posts = await this.prisma.post.findMany({
      where: { userId: user.id },
      select: { id: true, sourceMessageId: true, revisionMessageId: true },
    });
    const messageIds = posts.flatMap((post) =>
      [post.sourceMessageId, post.revisionMessageId].filter((id): id is string => Boolean(id)),
    );
    if (messageIds.length > 0) {
      await this.prisma.webhookEvent.deleteMany({ where: { waMessageId: { in: messageIds } } });
    }
    await Promise.all(posts.map((post) => this.removePreview(post.id)));
    await this.prisma.user.delete({ where: { id: user.id } });
    this.logger.log(`Deleted data for ${user.id}`);
  }

  private async removePreview(postId: string): Promise<void> {
    const dir = this.config.env.storageDir;
    if (!dir || !/^[\w-]+$/.test(postId)) {
      return;
    }
    const root = resolve(process.cwd(), dir);
    await Promise.all(
      ['svg', 'jpg'].map((ext) => unlink(join(root, `${postId}.${ext}`)).catch(() => undefined)),
    );
  }
}

function isDataDeletionRequest(text: string): boolean {
  return text.trim().toLowerCase().replace(/[.!]+$/g, '') === 'delete my data';
}
