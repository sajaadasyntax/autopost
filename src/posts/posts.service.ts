import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostCopy } from '../content/format-copy';

const pipelineInclude = { user: true, brand: true } satisfies Prisma.PostInclude;

export type PipelinePost = Prisma.PostGetPayload<{ include: typeof pipelineInclude }>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.post.findUnique({ where: { id } });
  }

  findBySourceMessageId(sourceMessageId: string) {
    return this.prisma.post.findUnique({ where: { sourceMessageId } });
  }

  findForPipeline(id: string): Promise<PipelinePost | null> {
    return this.prisma.post.findUnique({ where: { id }, include: pipelineInclude });
  }

  createGenerating(input: { userId: string; brandId: string; brief: string; sourceMessageId: string }) {
    return this.prisma.post.create({
      data: {
        userId: input.userId,
        brandId: input.brandId,
        brief: input.brief,
        sourceMessageId: input.sourceMessageId,
        status: PostStatus.generating,
      },
    });
  }

  beginRevision(postId: string, revisionMessageId: string) {
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        revisionMessageId,
        status: PostStatus.generating,
        headline: null,
        caption: null,
        hashtags: [],
        cta: null,
        imageUrl: null,
        canvaDesignId: null,
        previewSent: false,
        error: null,
      },
    });
  }

  saveCopy(postId: string, copy: PostCopy) {
    return this.prisma.post.update({
      where: { id: postId },
      data: copy,
    });
  }

  saveDesign(postId: string, design: { designId: string; imageUrl: string }) {
    return this.prisma.post.update({
      where: { id: postId },
      data: { canvaDesignId: design.designId, imageUrl: design.imageUrl },
    });
  }

  async markDraft(postId: string): Promise<boolean> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.generating },
      data: { status: PostStatus.draft, error: null },
    });
    return result.count === 1;
  }

  markPreviewSent(postId: string) {
    return this.prisma.post.update({
      where: { id: postId },
      data: { previewSent: true },
    });
  }

  async markApproved(postId: string): Promise<boolean> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.draft },
      data: { status: PostStatus.approved },
    });
    return result.count === 1;
  }

  async markPublishing(postId: string): Promise<boolean> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: { in: [PostStatus.draft, PostStatus.approved] } },
      data: { status: PostStatus.publishing },
    });
    return result.count === 1;
  }

  async markPublished(postId: string): Promise<boolean> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.publishing },
      data: { status: PostStatus.published, error: null },
    });
    return result.count === 1;
  }

  markFailed(postId: string, error: string) {
    return this.prisma.post.updateMany({
      where: {
        id: postId,
        status: { in: [PostStatus.generating, PostStatus.draft, PostStatus.approved, PostStatus.publishing] },
      },
      data: { status: PostStatus.failed, error },
    });
  }

  async cancelIfOpen(postId: string): Promise<boolean> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: { in: [PostStatus.generating, PostStatus.draft, PostStatus.approved] } },
      data: { status: PostStatus.cancelled },
    });
    return result.count === 1;
  }

  saveFbPostId(postId: string, fbPostId: string) {
    return this.prisma.post.update({ where: { id: postId }, data: { fbPostId } });
  }

  saveIgContainerId(postId: string, igContainerId: string) {
    return this.prisma.post.update({ where: { id: postId }, data: { igContainerId } });
  }

  saveIgMediaId(postId: string, igMediaId: string) {
    return this.prisma.post.update({ where: { id: postId }, data: { igMediaId } });
  }
}
