import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { requestJson } from '../common/http';
import { AppConfigService } from '../config/app-config.service';
import { AccountsService } from './accounts.service';

const SCOPES = ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish', 'pages_read_engagement'];

@Injectable()
export class FacebookOAuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly accounts: AccountsService,
  ) {}

  configured(): boolean {
    return Boolean(this.config.env.facebookAppId && this.config.env.facebookAppSecret);
  }

  authorizeUrl(userId: string): string {
    if (!this.configured()) {
      throw new BadRequestException('Facebook Login is not configured. Paste the Page token instead.');
    }
    const state = this.seal(userId);
    const url = new URL('https://www.facebook.com/dialog/oauth');
    url.searchParams.set('client_id', this.config.env.facebookAppId);
    url.searchParams.set('redirect_uri', this.redirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async exchange(code: string, state: string): Promise<void> {
    const userId = this.open(state);
    const tokenUrl = new URL(`https://graph.facebook.com/${this.config.env.graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', this.config.env.facebookAppId);
    tokenUrl.searchParams.set('client_secret', this.config.env.facebookAppSecret);
    tokenUrl.searchParams.set('redirect_uri', this.redirectUri());
    tokenUrl.searchParams.set('code', code);
    const { body } = await requestJson(tokenUrl.toString());
    const userToken = readString(body, 'access_token');
    if (!userToken) {
      throw new BadRequestException('Facebook did not return a token.');
    }
    const pagesUrl = new URL(`https://graph.facebook.com/${this.config.env.graphVersion}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}');
    pagesUrl.searchParams.set('access_token', userToken);
    const { body: pagesBody } = await requestJson(pagesUrl.toString());
    const page = firstPage(pagesBody);
    if (!page) {
      throw new BadRequestException('No Facebook Page was returned for this login.');
    }
    await this.accounts.saveOAuth(userId, page);
  }

  private redirectUri(): string {
    return `${this.config.env.publicBaseUrl}/studio/oauth/facebook/callback`;
  }

  private seal(userId: string): string {
    const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    const sig = createHmac('sha256', this.config.env.encryptionKey).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private open(state: string): string {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) {
      throw new BadRequestException('Facebook login state is invalid.');
    }
    const expected = createHmac('sha256', this.config.env.encryptionKey).update(payload).digest('base64url');
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new BadRequestException('Facebook login state is invalid.');
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('Facebook login state has expired.');
    }
    return parsed.userId;
  }
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function firstPage(body: unknown): { pageId: string; pageName: string; pageToken: string; igUserId?: string; igName?: string } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object' || !data[0]) {
    return null;
  }
  const page = data[0] as Record<string, unknown>;
  const pageId = typeof page.id === 'string' ? page.id : '';
  const pageToken = typeof page.access_token === 'string' ? page.access_token : '';
  if (!pageId || !pageToken) {
    return null;
  }
  const ig = page.instagram_business_account;
  const igRecord = ig && typeof ig === 'object' ? (ig as Record<string, unknown>) : null;
  return {
    pageId,
    pageName: typeof page.name === 'string' ? page.name : 'Facebook Page',
    pageToken,
    igUserId: igRecord && typeof igRecord.id === 'string' ? igRecord.id : undefined,
    igName: igRecord && typeof igRecord.username === 'string' ? igRecord.username : undefined,
  };
}
