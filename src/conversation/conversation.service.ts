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
import { StudioAuthService } from '../studio/studio-auth.service';
import { addDays, formatDate, khartoumDate, khartoumInstant, nextMonday, parseDate, weekdayIndex, weekdayNameAr } from '../common/khartoum';
import { COPY, POST_STATUS_AR } from '../whatsapp/copy';
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
    private readonly studio: StudioAuthService,
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
    await this.studio.ensureBrand(user.id);
    const conversation = await this.prisma.conversation.upsert({
      where: { userId: user.id },
      create: { userId: user.id, state: ConversationState.idle },
      update: {},
    });

    if (message.kind === 'text' && message.text && /^\d{6}$/.test(message.text.trim())) {
      const linked = await this.studio.confirmCode(phone, message.text);
      if (linked) {
        await this.whatsapp.sendText(phone, `${COPY.studioReady} ${linked.url}`);
        await this.whatsapp.sendText(phone, COPY.menu);
        return;
      }
    }

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
        await this.handleIdle(user, conversation, text);
        return;
      case ConversationState.generating:
        await this.whatsapp.sendText(user.phone, COPY.stillWorking);
        return;
      case ConversationState.awaiting_brief:
        await this.prisma.conversation.update({
          where: { userId: user.id },
          data: { state: ConversationState.awaiting_audience, pendingBrief: text },
        });
        await this.whatsapp.sendText(user.phone, COPY.askAudience);
        return;
      case ConversationState.awaiting_audience:
        await this.prisma.brand.updateMany({ where: { userId: user.id }, data: { audience: text } });
        await this.startGeneration(user, message, conversation.pendingBrief || text);
        return;
      case ConversationState.awaiting_approval:
        await this.handleApprovalText(user, conversation, text);
        return;
      case ConversationState.awaiting_edit:
        await this.revise(user, conversation, message, text);
        return;
      case ConversationState.awaiting_schedule_day:
        await this.chooseDay(user, conversation, text);
        return;
      case ConversationState.awaiting_schedule_time:
        await this.chooseTime(user, conversation, text);
        return;
      case ConversationState.awaiting_week_theme:
        await this.buildWeek(user, text);
        return;
      default:
        await this.whatsapp.sendText(user.phone, COPY.menu);
    }
  }

  private async handleIdle(user: User, conversation: Conversation, text: string): Promise<void> {
    const command = idleCommand(text);
    if (command === 'create') {
      await this.prisma.conversation.update({
        where: { userId: user.id },
        data: { state: ConversationState.awaiting_brief, pendingBrief: null },
      });
      await this.whatsapp.sendText(user.phone, COPY.askBrief);
      return;
    }
    if (command === 'week') {
      await this.prisma.conversation.update({
        where: { userId: user.id },
        data: { state: ConversationState.awaiting_week_theme },
      });
      await this.whatsapp.sendText(user.phone, COPY.askTheme);
      return;
    }
    if (command === 'schedule') {
      await this.beginSchedule(user, conversation);
      return;
    }
    if (command === 'drafts') {
      await this.sendDrafts(user);
      return;
    }
    if (command === 'brand') {
      await this.whatsapp.sendText(user.phone, `إعدادات العلامة: ${this.config.env.studioOrigin}/brand`);
      return;
    }
    if (command === 'analytics') {
      await this.sendAnalytics(user);
      return;
    }
    await this.whatsapp.sendText(user.phone, COPY.menu);
  }

  private async handleApprovalText(user: User, conversation: Conversation, text: string): Promise<void> {
    const choice = text.trim().toLowerCase();
    if (!conversation.activePostId) {
      await this.whatsapp.sendText(user.phone, COPY.tapButtons);
      return;
    }
    if (choice === '1' || choice === 'approve') {
      await this.approve(user, conversation.activePostId);
      return;
    }
    if (choice === '2' || choice === 'edit') {
      await this.prisma.conversation.update({
        where: { userId: user.id },
        data: { state: ConversationState.awaiting_edit },
      });
      await this.whatsapp.sendText(user.phone, COPY.editPrompt);
      return;
    }
    if (choice === '3' || choice === 'regenerate') {
      await this.regenerate(user, conversation.activePostId);
      return;
    }
    if (choice === '4' || choice === 'schedule') {
      await this.beginSchedule(user, conversation);
      return;
    }
    await this.whatsapp.sendText(user.phone, COPY.previewChoices);
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

    const brand = await this.prisma.brand.findUnique({ where: { userId: user.id } });
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

  private async regenerate(user: User, postId: string): Promise<void> {
    const post = await this.posts.findById(postId);
    if (!post || post.status !== PostStatus.draft) {
      await this.whatsapp.sendText(user.phone, COPY.tapButtons);
      return;
    }
    const messageId = `regen-${postId}-${Date.now()}`;
    await this.posts.beginRevision(postId, messageId);
    await this.prisma.conversation.update({
      where: { userId: user.id },
      data: { state: ConversationState.generating, activePostId: postId },
    });
    await this.whatsapp.sendText(user.phone, COPY.updating);
    await this.enqueueGenerate(postId, messageId);
  }

  private async beginSchedule(user: User, conversation: Conversation): Promise<void> {
    const active = conversation.activePostId ? await this.posts.findById(conversation.activePostId) : null;
    const post =
      active && (active.status === PostStatus.draft || active.status === PostStatus.scheduled)
        ? active
        : await this.prisma.post.findFirst({
            where: { userId: user.id, status: { in: [PostStatus.draft, PostStatus.scheduled] } },
            orderBy: { createdAt: 'desc' },
          });
    if (!post) {
      await this.whatsapp.sendText(user.phone, COPY.noDraft);
      return;
    }
    await this.prisma.conversation.update({
      where: { userId: user.id },
      data: { state: ConversationState.awaiting_schedule_day, schedulePostId: post.id, activePostId: post.id },
    });
    await this.whatsapp.sendText(user.phone, COPY.askDay);
  }

  private async chooseDay(user: User, conversation: Conversation, text: string): Promise<void> {
    const today = khartoumDate();
    const choice = text.trim().toLowerCase();
    const date = choice === '1' || choice === 'today' ? today : choice === '2' || choice === 'tomorrow' ? addDays(today, 1) : parseDate(text);
    if (!date) {
      await this.whatsapp.sendText(user.phone, COPY.askDay);
      return;
    }
    await this.prisma.conversation.update({
      where: { userId: user.id },
      data: { state: ConversationState.awaiting_schedule_time, pendingBrief: formatDate(date) },
    });
    await this.whatsapp.sendText(user.phone, COPY.askTime);
  }

  private async chooseTime(user: User, conversation: Conversation, text: string): Promise<void> {
    const hours: Record<string, number> = { '1': 9, '9': 9, '9am': 9, '2': 12, '12': 12, '12pm': 12, '3': 15, '3pm': 15, '4': 18, '6': 18, '6pm': 18 };
    const hour = hours[text.trim().toLowerCase()];
    const date = conversation.pendingBrief ? parseDate(conversation.pendingBrief) : null;
    if (!hour || !date || !conversation.schedulePostId) {
      await this.whatsapp.sendText(user.phone, COPY.askTime);
      return;
    }
    await this.prisma.post.update({
      where: { id: conversation.schedulePostId },
      data: { scheduledAt: khartoumInstant(date, hour), status: PostStatus.scheduled },
    });
    await this.idle(user.id);
    await this.whatsapp.sendText(user.phone, `${COPY.scheduled} ${formatDate(date)} الساعة ${hour}:00 بتوقيت الخرطوم.`);
  }

  private async buildWeek(user: User, text: string): Promise<void> {
    const theme = weekTheme(text);
    if (!theme) {
      await this.whatsapp.sendText(user.phone, COPY.askTheme);
      return;
    }
    const brand = await this.prisma.brand.findUnique({ where: { userId: user.id } });
    if (!brand) {
      await this.whatsapp.sendText(user.phone, COPY.noBrand);
      return;
    }
    const monday = nextMonday();
    const plan = await this.prisma.weekPlan.create({
      data: { userId: user.id, theme, startsOn: khartoumInstant(monday, 9) },
    });
    const lines: string[] = [COPY.weekStarted];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addDays(monday, offset);
      const brief = weekBrief(theme, day, brand.name);
      const sourceMessageId = `week-${plan.id}-${offset}`;
      const post = await this.posts.createGenerating({
        userId: user.id,
        brandId: brand.id,
        brief,
        sourceMessageId,
        scheduledAt: khartoumInstant(day, 9),
        weekPlanId: plan.id,
      });
      await this.enqueueGenerate(post.id, sourceMessageId);
      lines.push(`${weekdayNameAr(day)} ${formatDate(day)}: ${brief}`);
    }
    await this.idle(user.id);
    await this.whatsapp.sendText(user.phone, lines.join('\n'));
  }

  private async sendDrafts(user: User): Promise<void> {
    const rows = await this.prisma.post.findMany({
      where: { userId: user.id, status: { in: [PostStatus.draft, PostStatus.scheduled, PostStatus.published, PostStatus.failed] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    if (!rows.length) {
      await this.whatsapp.sendText(user.phone, COPY.noDraft);
      return;
    }
    const lines = rows.map((post) => `${POST_STATUS_AR[post.status] ?? post.status}: ${post.headline || post.brief}`);
    await this.whatsapp.sendText(user.phone, lines.join('\n'));
  }

  private async sendAnalytics(user: User): Promise<void> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.post.count({
      where: { userId: user.id, status: PostStatus.published, updatedAt: { gte: since } },
    });
    await this.whatsapp.sendText(
      user.phone,
      `آخر ٣٠ يوماً\nالمنشورات: ${count}\nافتح ${this.config.env.studioOrigin}/analytics`,
    );
  }

  private idle(userId: string) {
    return this.prisma.conversation.update({
      where: { userId },
      data: { state: ConversationState.idle, activePostId: null, pendingBrief: null, schedulePostId: null },
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
  const value = text.trim().toLowerCase().replace(/[.!]+$/g, '');
  return value === 'delete my data' || value === 'احذف بياناتي';
}

function idleCommand(text: string): 'menu' | 'create' | 'week' | 'schedule' | 'drafts' | 'brand' | 'analytics' | null {
  const value = text.trim().toLowerCase();
  if (['hi', 'hello', 'menu', 'start', 'مرحبا', 'أهلا', 'اهلا', 'القائمة'].includes(value)) return 'menu';
  if (value === '1' || value === 'create' || value === 'create post') return 'create';
  if (value === '2' || value.startsWith('generate')) return 'week';
  if (value === '3' || value === 'schedule' || value === 'schedule posts') return 'schedule';
  if (value === '4' || value === 'drafts' || value === 'view drafts') return 'drafts';
  if (value === '5' || value === 'brand' || value === 'brand settings') return 'brand';
  if (value === '6' || value === 'analytics') return 'analytics';
  return null;
}

function weekTheme(text: string): 'promotions' | 'educational' | 'mixed' | null {
  const value = text.trim().toLowerCase();
  if (value === '1' || value === 'promotions') return 'promotions';
  if (value === '2' || value === 'educational') return 'educational';
  if (value === '3' || value === 'mixed') return 'mixed';
  return null;
}

function weekBrief(
  theme: 'promotions' | 'educational' | 'mixed',
  day: { year: number; month: number; day: number },
  brand: string,
): string {
  const name = weekdayNameAr(day);
  const index = weekdayIndex(day);
  if (theme === 'promotions') return `عرض ${name} لـ ${brand}`;
  if (theme === 'educational') return `نصيحة ${name} لـ ${brand}`;
  if (index === 0 || index === 2 || index === 5) return `عرض ${name} لـ ${brand}`;
  return `نصيحة ${name} لـ ${brand}`;
}
