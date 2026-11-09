import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encryptString, parseEncryptionKey } from '../src/crypto/token-cipher';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const key = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY ?? '');
  const token = process.env.PAGE_ACCESS_TOKEN?.trim() || 'replace-me';
  const phone = (process.env.ALLOWLIST_PHONES ?? '').split(',')[0]?.replace(/\D/g, '') || '';
  const user = phone
    ? await prisma.user.upsert({
        where: { phone },
        create: { phone, name: 'Tester' },
        update: {},
      })
    : null;
  const data = {
    userId: user?.id,
    name: process.env.BRAND_NAME?.trim() || 'Smile Dental',
    tone: process.env.BRAND_TONE?.trim() || 'professional',
    audience: process.env.BRAND_AUDIENCE?.trim() || 'Adults 25-50',
    canvaBrandTemplateId: process.env.CANVA_BRAND_TEMPLATE_ID?.trim() || '',
    fbPageId: process.env.FB_PAGE_ID?.trim() || '',
    igUserId: process.env.IG_USER_ID?.trim() || '',
    pageAccessTokenEnc: encryptString(token, key),
  };
  const existing = user
    ? await prisma.brand.findFirst({ where: { OR: [{ userId: user.id }, { userId: null }] } })
    : await prisma.brand.findFirst();
  if (existing) {
    await prisma.brand.update({ where: { id: existing.id }, data });
  } else {
    await prisma.brand.create({ data });
  }
  if (user && data.fbPageId) {
    await prisma.connectedAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: 'facebook' } },
      create: { userId: user.id, platform: 'facebook', externalId: data.fbPageId, displayName: data.name, tokenEnc: data.pageAccessTokenEnc },
      update: { externalId: data.fbPageId, tokenEnc: data.pageAccessTokenEnc },
    });
  }
  if (user && data.igUserId) {
    await prisma.connectedAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: 'instagram' } },
      create: { userId: user.id, platform: 'instagram', externalId: data.igUserId, displayName: data.name, tokenEnc: data.pageAccessTokenEnc },
      update: { externalId: data.igUserId, tokenEnc: data.pageAccessTokenEnc },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
