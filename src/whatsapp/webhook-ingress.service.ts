import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { isUniqueViolation } from '../common/errors';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { INCOMING_JOBS, JobPort } from '../queue/job.port';
import { jobOptions } from '../queue/queue.names';
import { parseWebhook, readHubQuery } from './parse-webhook';
import { verifyWhatsappSignature } from './whatsapp-signature';

@Injectable()
export class WebhookIngressService {
  private readonly logger = new Logger(WebhookIngressService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    @Inject(INCOMING_JOBS) private readonly incomingQueue: JobPort,
  ) {}

  verify(query: Record<string, unknown>): string {
    const hub = readHubQuery(query);
    if (hub.mode !== 'subscribe' || hub.token !== this.config.env.whatsappVerifyToken || !hub.challenge) {
      throw new UnauthorizedException();
    }
    return hub.challenge;
  }

  async receive(rawBody: Buffer | undefined, signature: string | undefined, payload: unknown): Promise<void> {
    if (!rawBody || !verifyWhatsappSignature(rawBody, signature, this.config.env.whatsappAppSecret)) {
      throw new UnauthorizedException();
    }

    for (const message of parseWebhook(payload)) {
      try {
        await this.prisma.webhookEvent.create({ data: { waMessageId: message.messageId } });
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }

      try {
        await this.incomingQueue.add('incoming', message, jobOptions(`incoming:${message.messageId}`, 2000));
      } catch (error) {
        await this.prisma.webhookEvent.delete({ where: { waMessageId: message.messageId } }).catch(() => undefined);
        throw error;
      }
      this.logger.log(`Queued ${message.messageId}`);
    }
  }
}
