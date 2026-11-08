import { Controller, HttpCode, Post, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhookIngressService } from './webhook-ingress.service';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('webhooks/whatsapp')
export class WhatsappController {
  constructor(private readonly ingress: WebhookIngressService) {}

  @Get()
  verify(@Req() req: Request, @Res() res: Response): void {
    try {
      const challenge = this.ingress.verify(req.query as Record<string, unknown>);
      res.status(200).type('text/plain').send(challenge);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        res.status(403).send('Forbidden');
        return;
      }
      throw error;
    }
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawRequest): Promise<{ ok: true }> {
    await this.ingress.receive(req.rawBody, req.header('x-hub-signature-256'), req.body);
    return { ok: true };
  }
}
