import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encryptString, parseEncryptionKey } from '../src/crypto/token-cipher';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const key = parseEncryptionKey(process.env.APP_ENCRYPTION_KEY ?? '');
  const token = process.env.PAGE_ACCESS_TOKEN?.trim() || 'replace-me';
  const data = {
    name: process.env.BRAND_NAME?.trim() || 'Smile Dental',
    tone: process.env.BRAND_TONE?.trim() || 'Warm, professional, and reassuring',
    audience: process.env.BRAND_AUDIENCE?.trim() || 'Adults 25-50',
    canvaBrandTemplateId: process.env.CANVA_BRAND_TEMPLATE_ID?.trim() || '',
    fbPageId: process.env.FB_PAGE_ID?.trim() || '',
    igUserId: process.env.IG_USER_ID?.trim() || '',
    pageAccessTokenEnc: encryptString(token, key),
  };
  const existing = await prisma.brand.findFirst();
  if (existing) {
    await prisma.brand.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.brand.create({ data });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
