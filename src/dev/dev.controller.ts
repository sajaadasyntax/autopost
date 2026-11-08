import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ConversationService } from '../conversation/conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from './outbox.service';

type DevMessage = {
  from?: string;
  text?: string;
  buttonId?: string;
};

@Controller('dev')
export class DevController {
  constructor(
    private readonly config: AppConfigService,
    private readonly conversation: ConversationService,
    private readonly outbox: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('outbox')
  outboxMessages() {
    this.assertLocal();
    return this.outbox.list();
  }

  @Get('posts')
  async posts() {
    this.assertLocal();
    const rows = await this.prisma.post.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((post) => ({
      id: post.id,
      brief: post.brief,
      headline: post.headline,
      caption: post.caption,
      status: post.status,
      imageUrl: post.imageUrl,
      fbPostId: post.fbPostId,
      igMediaId: post.igMediaId,
      error: post.error,
    }));
  }

  @Post('messages')
  async message(@Body() body: DevMessage) {
    this.assertLocal();
    const from = body.from?.trim() || '15551230000';
    const messageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.conversation.handle(
      body.buttonId
        ? { messageId, from, kind: 'button', buttonId: body.buttonId }
        : { messageId, from, name: 'Local', kind: 'text', text: body.text ?? '' },
    );
    return { ok: true, messageId };
  }

  private assertLocal(): void {
    if (!this.config.env.localDev) {
      throw new NotFoundException();
    }
  }
}
