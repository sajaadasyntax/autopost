import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { normalizePhone } from '../common/phones';
import { AppConfigService } from '../config/app-config.service';
import { TokenCipher } from '../crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { loginCode, randomToken, tokenHash } from './tokens';

const CODE_MS = 15 * 60 * 1000;
const LINK_MS = 30 * 60 * 1000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class StudioAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly cipher: TokenCipher,
  ) {}

  async requestCode(phoneInput: string): Promise<{ phone: string; code: string }> {
    const phone = normalizePhone(phoneInput);
    if (!phone || !this.config.env.allowlist.has(phone)) {
      throw new ForbiddenException('This phone is not on the tester list.');
    }
    const code = loginCode();
    const expiresAt = new Date(Date.now() + CODE_MS);
    await this.prisma.loginCode.create({ data: { phone, code, expiresAt } });
    return { phone, code };
  }

  async confirmCode(fromPhone: string, text: string): Promise<{ user: User; url: string } | null> {
    const phone = normalizePhone(fromPhone);
    const code = text.trim();
    if (!/^\d{6}$/.test(code) || !this.config.env.allowlist.has(phone)) {
      return null;
    }
    const row = await this.prisma.loginCode.findFirst({
      where: { phone, code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      return null;
    }
    await this.prisma.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });
    await this.ensureBrand(user.id);
    const token = randomToken();
    await this.prisma.studioLink.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + LINK_MS) },
    });
    return { user, url: `${this.config.env.studioOrigin}/enter?token=${token}` };
  }

  async openLink(token: string): Promise<string> {
    const link = await this.prisma.studioLink.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('This login link has expired.');
    }
    await this.prisma.studioLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    return this.createSession(link.userId);
  }

  async userForToken(token: string | undefined): Promise<User> {
    if (!token) {
      throw new UnauthorizedException();
    }
    const session = await this.prisma.studioSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException();
    }
    if (!this.config.env.allowlist.has(session.user.phone)) {
      throw new ForbiddenException();
    }
    return session.user;
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomToken();
    await this.prisma.studioSession.create({
      data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_MS) },
    });
    return token;
  }

  async ensureBrand(userId: string): Promise<void> {
    const owned = await this.prisma.brand.findUnique({ where: { userId } });
    if (owned) {
      return;
    }
    const loose = await this.prisma.brand.findFirst({ where: { userId: null } });
    if (loose) {
      await this.prisma.brand.update({ where: { id: loose.id }, data: { userId } });
      return;
    }
    await this.prisma.brand.create({
      data: {
        userId,
        name: 'My business',
        tone: 'professional',
        audience: 'Adults 25-45',
        pageAccessTokenEnc: this.cipher.encrypt('replace-me'),
      },
    });
  }
}
