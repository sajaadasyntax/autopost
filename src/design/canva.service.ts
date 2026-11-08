import { Injectable } from '@nestjs/common';
import { PermanentError } from '../common/errors';
import { pollUntil, requestBuffer, requestJson } from '../common/http';
import { AppConfigService } from '../config/app-config.service';
import { TokenCipher } from '../crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { readCanvaJob, readTokenResponse } from './canva-job';
import { createPkcePair } from './pkce';
import { openOauthState, sealOauthState } from './oauth-state';

export const CANVA_PROVIDER = 'canva';
const CANVA_API = 'https://api.canva.com/rest/v1';
const CANVA_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
].join(' ');

@Injectable()
export class CanvaService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipher,
  ) {}

  async isConfigured(): Promise<boolean> {
    if (!this.config.env.canvaClientId || !this.config.env.canvaClientSecret) {
      return false;
    }
    const row = await this.prisma.integrationCredential.findUnique({ where: { provider: CANVA_PROVIDER } });
    return Boolean(row?.refreshTokenEnc);
  }

  buildAuthorizeUrl(): string {
    const { canvaClientId, canvaRedirectUri } = this.config.env;
    if (!canvaClientId || !canvaRedirectUri) {
      throw new PermanentError('CANVA_CLIENT_ID and CANVA_REDIRECT_URI are required.');
    }
    const { verifier, challenge } = createPkcePair();
    const state = sealOauthState({ verifier, exp: Date.now() + 10 * 60 * 1000 }, this.config.env.encryptionKey);
    const url = new URL('https://www.canva.com/api/oauth/authorize');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', canvaClientId);
    url.searchParams.set('redirect_uri', canvaRedirectUri);
    url.searchParams.set('scope', CANVA_SCOPES);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string, state: string): Promise<void> {
    const sealed = openOauthState(state, this.config.env.encryptionKey);
    const tokens = await this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: sealed.verifier,
      redirect_uri: this.config.env.canvaRedirectUri,
    });
    await this.storeTokens(tokens);
  }

  async getTemplateDataset(): Promise<unknown> {
    const brand = await this.prisma.brand.findFirst();
    if (!brand?.canvaBrandTemplateId) {
      throw new PermanentError('The brand has no Canva template id.');
    }
    const token = await this.getAccessToken();
    const { body } = await requestJson(`${CANVA_API}/brand-templates/${brand.canvaBrandTemplateId}/dataset`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return body;
  }

  async autofillAndExport(input: {
    templateId: string;
    headline: string;
    caption: string;
    cta: string;
  }): Promise<{ designId: string; bytes: Buffer }> {
    const { canvaFieldHeadline, canvaFieldCaption, canvaFieldCta } = this.config.env;
    const created = await this.authorized('POST', '/autofills', {
      brand_template_id: input.templateId,
      data: {
        [canvaFieldHeadline]: { type: 'text', text: input.headline },
        [canvaFieldCaption]: { type: 'text', text: input.caption },
        [canvaFieldCta]: { type: 'text', text: input.cta },
      },
    });
    const started = readCanvaJob(created);
    if (started.state === 'failed') {
      throw new PermanentError(started.error || 'Canva could not start the autofill.');
    }
    const jobId = this.jobId(created);
    const filled = await pollUntil(
      async () => {
        const body = await this.authorized('GET', `/autofills/${jobId}`);
        const job = readCanvaJob(body);
        if (job.state === 'failed') {
          throw new PermanentError(job.error || 'Canva autofill failed.');
        }
        return job.state === 'success' ? job : undefined;
      },
      { attempts: 40, delayMs: 3000 },
    );
    if (!filled.designId) {
      throw new PermanentError('Canva autofill finished without a design id.');
    }

    const exportJob = await this.authorized('POST', '/exports', {
      design_id: filled.designId,
      format: { type: 'jpg', quality: 90 },
    });
    const exportId = this.jobId(exportJob);
    const exported = await pollUntil(
      async () => {
        const body = await this.authorized('GET', `/exports/${exportId}`);
        const job = readCanvaJob(body);
        if (job.state === 'failed') {
          throw new PermanentError(job.error || 'Canva export failed.');
        }
        return job.state === 'success' ? job : undefined;
      },
      { attempts: 40, delayMs: 3000 },
    );
    if (!exported.downloadUrl) {
      throw new PermanentError('Canva export finished without a download URL.');
    }
    const bytes = await requestBuffer(exported.downloadUrl);
    return { designId: filled.designId, bytes };
  }

  private async getAccessToken(): Promise<string> {
    const row = await this.prisma.integrationCredential.findUnique({ where: { provider: CANVA_PROVIDER } });
    if (!row?.refreshTokenEnc) {
      throw new PermanentError('Canva is not connected.');
    }
    const fresh = row.accessTokenEnc && row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000;
    if (fresh && row.accessTokenEnc) {
      return this.cipher.decrypt(row.accessTokenEnc);
    }
    const tokens = await this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: this.cipher.decrypt(row.refreshTokenEnc),
    });
    await this.storeTokens(tokens);
    return tokens.accessToken;
  }

  private async storeTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }): Promise<void> {
    const data = {
      refreshTokenEnc: this.cipher.encrypt(tokens.refreshToken),
      accessTokenEnc: this.cipher.encrypt(tokens.accessToken),
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };
    await this.prisma.integrationCredential.upsert({
      where: { provider: CANVA_PROVIDER },
      create: { provider: CANVA_PROVIDER, ...data },
      update: data,
    });
  }

  private async tokenRequest(fields: Record<string, string>) {
    const { canvaClientId, canvaClientSecret } = this.config.env;
    const credentials = Buffer.from(`${canvaClientId}:${canvaClientSecret}`).toString('base64');
    const { body } = await requestJson(`${CANVA_API}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields),
    });
    return readTokenResponse(body);
  }

  private async authorized(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<unknown> {
    const token = await this.getAccessToken();
    const { body } = await requestJson(`${CANVA_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return body;
  }

  private jobId(body: unknown): string {
    const record = body && typeof body === 'object' ? (body as { job?: { id?: string } }) : {};
    const id = record.job?.id;
    if (!id) {
      throw new PermanentError('Canva did not return a job id.');
    }
    return id;
  }
}
