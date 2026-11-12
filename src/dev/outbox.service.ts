import { Injectable } from '@nestjs/common';

export type OutboxButton = { id: string; title: string };

export type OutboxMessage = {
  at: string;
  to: string;
  kind: 'text' | 'preview' | 'image';
  body: string;
  imageUrl?: string | null;
  buttons?: OutboxButton[];
};

@Injectable()
export class OutboxService {
  private readonly messages: OutboxMessage[] = [];

  push(message: Omit<OutboxMessage, 'at'>): void {
    this.messages.push({ ...message, at: new Date().toISOString() });
  }

  list(): OutboxMessage[] {
    return [...this.messages];
  }
}
