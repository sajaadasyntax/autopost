import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Response } from 'express';
import { PostStatus } from '@prisma/client';
import { publicError } from '../common/errors';
import { requestJson } from '../common/http';
import { AppConfigService } from '../config/app-config.service';
import { TokenCipher } from '../crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService, BrandInput } from './accounts.service';
import { FacebookOAuthService } from './facebook-oauth.service';
import { StudioAuthService } from './studio-auth.service';
import { StudioRequest, StudioSessionGuard } from './studio-session.guard';

@Controller('studio')
export class StudioController {
  constructor(
    private readonly auth: StudioAuthService,
    private readonly accounts: AccountsService,
    private readonly facebook: FacebookOAuthService,
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipher,
    private readonly config: AppConfigService,
  ) {}

  @Post('login')
  login(@Body() body: { phone?: string }) {
    return this.auth.requestCode(body.phone ?? '');
  }

  @Post('enter')
  async enter(@Body() body: { token?: string }) {
    const sessionToken = await this.auth.openLink(body.token ?? '');
    return { sessionToken };
  }

  @Get('me')
  @UseGuards(StudioSessionGuard)
  async me(@Req() request: StudioRequest) {
    const user = request.studioUser!;
    const brand = await this.accounts.brandFor(user.id);
    return { id: user.id, phone: user.phone, name: user.name, brandId: brand?.id ?? null };
  }

  @Get('brand')
  @UseGuards(StudioSessionGuard)
  async getBrand(@Req() request: StudioRequest) {
    const brand = await this.accounts.brandFor(request.studioUser!.id);
    if (!brand) {
      throw new BadRequestException('Brand is missing.');
    }
    return publicBrand(brand);
  }

  @Put('brand')
  @UseGuards(StudioSessionGuard)
  async putBrand(@Req() request: StudioRequest, @Body() body: BrandInput) {
    const brand = await this.accounts.updateBrand(request.studioUser!.id, body);
    return publicBrand(brand);
  }

  @Post('brand/logo')
  @UseGuards(StudioSessionGuard)
  async logo(@Req() request: StudioRequest, @Body() body: { dataBase64?: string }) {
    const raw = body.dataBase64?.replace(/^data:image\/\w+;base64,/, '') ?? '';
    const bytes = Buffer.from(raw, 'base64');
    if (!raw || bytes.length < 32 || bytes.length > 2_000_000) {
      throw new BadRequestException('Upload a PNG or JPEG logo under 2MB.');
    }
    const root = resolve(process.cwd(), this.config.env.storageDir);
    await mkdir(root, { recursive: true });
    const name = `logo-${request.studioUser!.id}.png`;
    await writeFile(join(root, name), bytes);
    const logoUrl = `${this.config.env.publicBaseUrl}/media/${name}`;
    const brand = await this.accounts.setLogo(request.studioUser!.id, logoUrl);
    return publicBrand(brand);
  }

  @Get('accounts')
  @UseGuards(StudioSessionGuard)
  accountsList(@Req() request: StudioRequest) {
    return this.accounts.list(request.studioUser!.id);
  }

  @Post('accounts')
  @UseGuards(StudioSessionGuard)
  async saveAccounts(
    @Req() request: StudioRequest,
    @Body() body: { fbPageId?: string; igUserId?: string; pageAccessToken?: string },
  ) {
    await this.accounts.saveManual(request.studioUser!.id, body);
    return this.accounts.list(request.studioUser!.id);
  }

  @Get('oauth/facebook')
  @UseGuards(StudioSessionGuard)
  startFacebook(@Req() request: StudioRequest, @Res() res: Response): void {
    res.redirect(this.facebook.authorizeUrl(request.studioUser!.id));
  }

  @Get('oauth/facebook/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async facebookCallback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    if (error) {
      throw new BadRequestException(`Facebook authorization failed: ${error}`);
    }
    if (!code || !state) {
      throw new UnauthorizedException('Facebook did not return a code.');
    }
    try {
      await this.facebook.exchange(code, state);
    } catch (caught) {
      throw new BadRequestException(publicError(caught));
    }
    return `<p>Facebook connected. Return to <a href="${this.config.env.studioOrigin}/connect">the studio</a>.</p>`;
  }

  @Get('posts')
  @UseGuards(StudioSessionGuard)
  async posts(@Req() request: StudioRequest, @Query('status') status?: string) {
    const allowed = new Set(Object.values(PostStatus));
    const where = {
      userId: request.studioUser!.id,
      ...(status && allowed.has(status as PostStatus) ? { status: status as PostStatus } : {}),
    };
    const rows = await this.prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map(publicPost);
  }

  @Get('calendar')
  @UseGuards(StudioSessionGuard)
  async calendar(@Req() request: StudioRequest) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - start.getUTCDay() + 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.post.findMany({
      where: {
        userId: request.studioUser!.id,
        OR: [{ scheduledAt: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map(publicPost);
  }

  @Get('analytics')
  @UseGuards(StudioSessionGuard)
  async analytics(@Req() request: StudioRequest) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const published = await this.prisma.post.findMany({
      where: { userId: request.studioUser!.id, status: PostStatus.published, updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
    });
    const best = published[0] ?? null;
    const insights = await this.pageInsights(request.studioUser!.id);
    return {
      postsPublished: published.length,
      reach: insights.reach,
      engagement: insights.engagement,
      bestPost: best ? { id: best.id, headline: best.headline, brief: best.brief } : null,
    };
  }

  private async pageInsights(userId: string): Promise<{ reach: number | null; engagement: number | null }> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId_platform: { userId, platform: 'facebook' } },
    });
    if (!account) {
      return { reach: null, engagement: null };
    }
    try {
      const token = this.cipher.decrypt(account.tokenEnc);
      const url = new URL(`https://graph.facebook.com/${this.config.env.graphVersion}/${account.externalId}/insights`);
      url.searchParams.set('metric', 'page_impressions,page_post_engagements');
      url.searchParams.set('period', 'days_28');
      url.searchParams.set('access_token', token);
      const { body } = await requestJson(url.toString());
      return { reach: metricValue(body, 'page_impressions'), engagement: metricValue(body, 'page_post_engagements') };
    } catch {
      return { reach: null, engagement: null };
    }
  }
}

function publicBrand(brand: {
  id: string;
  name: string;
  tone: string;
  audience: string;
  industry: string;
  website: string;
  primaryColor: string;
  logoUrl: string;
  description: string;
}) {
  return {
    id: brand.id,
    name: brand.name,
    tone: brand.tone,
    audience: brand.audience,
    industry: brand.industry,
    website: brand.website,
    primaryColor: brand.primaryColor,
    logoUrl: brand.logoUrl,
    description: brand.description,
  };
}

function publicPost(post: {
  id: string;
  brief: string;
  headline: string | null;
  caption: string | null;
  status: PostStatus;
  imageUrl: string | null;
  scheduledAt: Date | null;
  createdAt: Date;
  error: string | null;
}) {
  return {
    id: post.id,
    brief: post.brief,
    headline: post.headline,
    caption: post.caption,
    status: post.status,
    imageUrl: post.imageUrl,
    scheduledAt: post.scheduledAt,
    createdAt: post.createdAt,
    error: post.error,
  };
}

function metricValue(body: unknown, name: string): number | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return null;
  }
  const metric = data.find((item) => item && typeof item === 'object' && (item as { name?: string }).name === name);
  if (!metric || typeof metric !== 'object') {
    return null;
  }
  const values = (metric as { values?: unknown }).values;
  if (!Array.isArray(values) || !values.length || typeof values[0] !== 'object' || !values[0]) {
    return null;
  }
  const value = (values[0] as { value?: unknown }).value;
  return typeof value === 'number' ? value : null;
}
