import { BadRequestException, Injectable } from '@nestjs/common';
import { Brand } from '@prisma/client';
import { TokenCipher } from '../crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';

const TONES = new Set(['professional', 'friendly', 'luxury', 'educational']);

export type BrandInput = {
  name?: string;
  industry?: string;
  website?: string;
  primaryColor?: string;
  description?: string;
  tone?: string;
  audience?: string;
  templateId?: string;
};

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipher,
  ) {}

  brandFor(userId: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({ where: { userId } });
  }

  async updateBrand(userId: string, input: BrandInput): Promise<Brand> {
    const tone = input.tone?.trim().toLowerCase();
    if (tone && !TONES.has(tone)) {
      throw new BadRequestException('Tone must be professional, friendly, luxury, or educational.');
    }
    const data: Record<string, string | null | undefined> = {
      name: input.name?.trim(),
      industry: input.industry?.trim(),
      website: input.website?.trim(),
      primaryColor: input.primaryColor?.trim(),
      description: input.description?.trim(),
      tone,
      audience: input.audience?.trim(),
    };
    if (input.templateId !== undefined) {
      data.templateId = await this.publishedTemplateId(input.templateId);
    }
    const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    return this.prisma.brand.update({ where: { userId }, data: clean });
  }

  private async publishedTemplateId(templateId: string): Promise<string | null> {
    if (!templateId) {
      return null;
    }
    const template = await this.prisma.designTemplate.findUnique({ where: { id: templateId } });
    if (!template?.published) {
      throw new BadRequestException('Choose a published template.');
    }
    return template.id;
  }

  async setLogo(userId: string, logoUrl: string): Promise<Brand> {
    return this.prisma.brand.update({ where: { userId }, data: { logoUrl } });
  }

  async list(userId: string) {
    const rows = await this.prisma.connectedAccount.findMany({ where: { userId } });
    const byPlatform = new Map(rows.map((row) => [row.platform, row]));
    return ['facebook', 'instagram', 'linkedin', 'x'].map((platform) => {
      const row = byPlatform.get(platform);
      return {
        platform,
        connected: Boolean(row),
        available: platform === 'facebook' || platform === 'instagram',
        displayName: row?.displayName ?? '',
        externalId: row?.externalId ?? '',
      };
    });
  }

  async saveManual(
    userId: string,
    input: { fbPageId?: string; igUserId?: string; pageAccessToken?: string },
  ): Promise<void> {
    const token = input.pageAccessToken?.trim() ?? '';
    const fbPageId = input.fbPageId?.trim() ?? '';
    const igUserId = input.igUserId?.trim() ?? '';
    if (!token || !fbPageId) {
      throw new BadRequestException('Facebook Page id and Page token are required.');
    }
    const tokenEnc = this.cipher.encrypt(token);
    await this.upsert(userId, 'facebook', fbPageId, 'Facebook Page', tokenEnc);
    if (igUserId) {
      await this.upsert(userId, 'instagram', igUserId, 'Instagram', tokenEnc);
    }
    await this.prisma.brand.update({
      where: { userId },
      data: { fbPageId, igUserId, pageAccessTokenEnc: tokenEnc },
    });
  }

  async saveOAuth(
    userId: string,
    input: { pageId: string; pageName: string; pageToken: string; igUserId?: string; igName?: string },
  ): Promise<void> {
    const tokenEnc = this.cipher.encrypt(input.pageToken);
    await this.upsert(userId, 'facebook', input.pageId, input.pageName, tokenEnc);
    if (input.igUserId) {
      await this.upsert(userId, 'instagram', input.igUserId, input.igName || 'Instagram', tokenEnc);
    }
    await this.prisma.brand.update({
      where: { userId },
      data: {
        fbPageId: input.pageId,
        igUserId: input.igUserId ?? '',
        pageAccessTokenEnc: tokenEnc,
      },
    });
  }

  private upsert(userId: string, platform: string, externalId: string, displayName: string, tokenEnc: string) {
    return this.prisma.connectedAccount.upsert({
      where: { userId_platform: { userId, platform } },
      create: { userId, platform, externalId, displayName, tokenEnc },
      update: { externalId, displayName, tokenEnc },
    });
  }
}
