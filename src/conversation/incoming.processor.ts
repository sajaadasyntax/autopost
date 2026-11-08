import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INCOMING_QUEUE } from '../queue/queue.names';
import { IncomingMessage } from '../whatsapp/parse-webhook';
import { ConversationService } from './conversation.service';

@Processor(INCOMING_QUEUE)
export class IncomingProcessor extends WorkerHost {
  constructor(private readonly conversation: ConversationService) {
    super();
  }

  async process(job: Job<IncomingMessage>): Promise<void> {
    await this.conversation.handle(job.data);
  }
}
