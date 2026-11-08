import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { WebhookIngressService } from './webhook-ingress.service';
import { WhatsappController } from './whatsapp.controller';

describe('WhatsappController', () => {
  let app: INestApplication;
  const ingress = {
    verify: jest.fn(() => '12345'),
    receive: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [{ provide: WebhookIngressService, useValue: ingress }],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the Meta verification challenge as plain text', async () => {
    await request(app.getHttpServer())
      .get('/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify', 'hub.challenge': '12345' })
      .expect(200)
      .expect('12345');
  });

  it('passes the raw body and signature to the ingress', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/whatsapp')
      .set('x-hub-signature-256', 'sha256=abc')
      .send({ entry: [] })
      .expect(200);
    expect(ingress.receive).toHaveBeenCalledWith(expect.any(Buffer), 'sha256=abc', { entry: [] });
  });
});
