import { Injectable, Logger } from '@nestjs/common';
import { Brand, User } from '@prisma/client';
import { blankTemplate } from '../design/template-document';
import { DesignService } from '../design/design.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class BrandPreviewService {
  private readonly logger = new Logger(BrandPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly design: DesignService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async send(user: User, brand: Brand): Promise<void> {
    const template = brand.templateId
      ? await this.prisma.designTemplate.findUnique({ where: { id: brand.templateId } })
      : await this.prisma.designTemplate.findFirst({ where: { published: true }, orderBy: { updatedAt: 'desc' } });
    const image = await this.design.renderTemplate({
      postId: `brand-${user.id}`,
      document: template?.document ?? blankTemplate(),
      headline: brand.name || 'علامتك',
      caption: brand.description || brand.audience || brand.industry || brand.name || 'تفاصيل المنتج',
      cta: 'اطلب الآن',
    });
    await this.whatsapp.sendImage(
      user.phone,
      image.imageUrl,
      'هذه صورة القالب بعد حفظ العلامة. الاسم والوصف داخل الصورة هما تفاصيل منتجك.',
    );
    this.logger.log(`Sent brand template preview to ${user.phone}`);
  }
}
