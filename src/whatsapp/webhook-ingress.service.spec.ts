import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookIngressService } from './webhook-ingress.service';

describe('WebhookIngressService', () => {
  const seen = new Set<string>();
  const queue = { add: jest.fn() };
  const prisma = {
    webhookEvent: {
      create: jest.fn(async ({ data }: { data: { waMessageId: string } }) => {
        if (seen.has(data.waMessageId)) {
          throw { code: 'P2002' };
        }
        seen.add(data.waMessageId);
        return data;
      }),
      delete: jest.fn(async ({ where }: { where: { waMessageId: string } }) => {
        seen.delete(where.waMessageId);
      }),
    },
  };
  const secret = 'app-secret';
  const service = new WebhookIngressService(
    { env: { whatsappVerifyToken: 'verify-me', whatsappAppSecret: secret } } as never,
    prisma as never,
    queue as never,
  );

  beforeEach(() => {
    seen.clear();
    jest.clearAllMocks();
  });

  it('returns the hub challenge only when the verify token matches', () => {
    expect(service.verify({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '99' })).toBe('99');
    expect(() => service.verify({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '99' })).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a bad signature before touching the queue', async () => {
    await expect(service.receive(Buffer.from('{}'), 'sha256=nope', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues a message once and drops the row if the queue is down', async () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ from: '1555', id: 'wamid.1', type: 'text', text: { body: 'hi' } }] } }] }],
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    await service.receive(raw, signature, payload);
    await service.receive(raw, signature, payload);
    expect(queue.add).toHaveBeenCalledTimes(1);

    seen.clear();
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    const second = {
      entry: [{ changes: [{ value: { messages: [{ from: '1555', id: 'wamid.2', type: 'text', text: { body: 'again' } }] } }] }],
    };
    const rawSecond = Buffer.from(JSON.stringify(second));
    const signatureSecond = `sha256=${createHmac('sha256', secret).update(rawSecond).digest('hex')}`;
    await expect(service.receive(rawSecond, signatureSecond, second)).rejects.toThrow('redis down');
    expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({ where: { waMessageId: 'wamid.2' } });
    expect(seen.has('wamid.2')).toBe(false);
  });
});
