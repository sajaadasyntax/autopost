import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PermanentError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { blankTemplate, parseTemplateDocument, TemplateDocument } from '../design/template-document';

export const STARTER_TEMPLATE_ID = 'starter-square';

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureStarter();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Starter template was not created.');
    }
  }

  async ensureStarter() {
    const existing = await this.prisma.designTemplate.findUnique({ where: { id: STARTER_TEMPLATE_ID } });
    if (existing) {
      return existing;
    }
    return this.prisma.designTemplate.create({
      data: {
        id: STARTER_TEMPLATE_ID,
        name: 'قالب مربع',
        published: true,
        document: blankTemplate() as unknown as Prisma.InputJsonValue,
      },
    });
  }

  list(publishedOnly: boolean) {
    return this.prisma.designTemplate.findMany({
      where: publishedOnly ? { published: true } : undefined,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, published: true, updatedAt: true },
    });
  }

  async get(id: string) {
    const template = await this.prisma.designTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new BadRequestException('Template not found.');
    }
    return template;
  }

  create(name: string) {
    return this.prisma.designTemplate.create({
      data: { name: name.trim() || 'قالب جديد', document: blankTemplate() as unknown as Prisma.InputJsonValue },
    });
  }

  async update(id: string, input: { name?: string; document?: unknown; published?: boolean }) {
    await this.get(id);
    let document: Prisma.InputJsonValue | undefined;
    if (input.document !== undefined) {
      try {
        document = parseTemplateDocument(input.document) as unknown as Prisma.InputJsonValue;
      } catch (error) {
        throw new BadRequestException(error instanceof PermanentError ? error.message : 'Template is invalid.');
      }
    }
    return this.prisma.designTemplate.update({
      where: { id },
      data: {
        name: input.name?.trim() || undefined,
        published: input.published,
        document,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.brand.updateMany({ where: { templateId: id }, data: { templateId: null } });
    await this.prisma.designTemplate.delete({ where: { id } });
  }
}

export type { TemplateDocument };
