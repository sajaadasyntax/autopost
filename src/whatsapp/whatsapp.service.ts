import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { requestJson } from '../common/http';
import { OutboxService } from '../dev/outbox.service';

const PREVIEW_BUTTONS = [
  { title: 'موافقة', action: 'approve' },
  { title: 'تعديل', action: 'edit' },
  { title: 'إلغاء', action: 'cancel' },
] as const;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly outbox: OutboxService,
  ) {}

  async sendText(to: string, body: string): Promise<void> {
    if (this.config.env.whatsappTransport === 'local') {
      this.outbox.push({ to, kind: 'text', body });
      this.logger.log(`Local WhatsApp to ${to}: ${body}`);
      return;
    }
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    });
  }

  async sendDraftPreview(input: {
    to: string;
    postId: string;
    body: string;
    imageUrl?: string | null;
  }): Promise<void> {
    if (this.config.env.whatsappTransport === 'local') {
      this.outbox.push({
        to: input.to,
        kind: 'preview',
        body: input.body,
        imageUrl: input.imageUrl,
        buttons: PREVIEW_BUTTONS.map((button) => ({ id: `${button.action}:${input.postId}`, title: button.title })),
      });
      this.logger.log(`Local preview for ${input.to} (${input.postId})`);
      return;
    }
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: input.body },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `approve:${input.postId}`, title: 'موافقة' } },
          { type: 'reply', reply: { id: `edit:${input.postId}`, title: 'تعديل' } },
          { type: 'reply', reply: { id: `cancel:${input.postId}`, title: 'إلغاء' } },
        ],
      },
    };
    if (input.imageUrl?.startsWith('https://')) {
      interactive.header = { type: 'image', image: { link: input.imageUrl } };
    }
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'interactive',
      interactive,
    });
  }

  async markRead(messageId: string): Promise<void> {
    if (this.config.env.whatsappTransport === 'local') {
      return;
    }
    try {
      await this.post({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch {
      this.logger.warn(`Could not mark ${messageId} as read`);
    }
  }

  private async post(payload: unknown): Promise<void> {
    const { graphVersion, whatsappPhoneNumberId, whatsappToken } = this.config.env;
    await requestJson(`https://graph.facebook.com/${graphVersion}/${whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
