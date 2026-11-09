import { Injectable } from '@nestjs/common';
import { PermanentError } from '../common/errors';
import { formatPostText } from '../content/format-copy';
import { AppConfigService } from '../config/app-config.service';
import { TokenCipher } from '../crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { MetaService } from './meta.service';

export const UNCONFIGURED_PAGE_TOKEN = 'replace-me';

@Injectable()
export class PublishingService {
  constructor(
    private readonly posts: PostsService,
    private readonly meta: MetaService,
    private readonly cipher: TokenCipher,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async publish(postId: string): Promise<void> {
    const post = await this.posts.findForPipeline(postId);
    if (!post) {
      throw new PermanentError('Post not found.');
    }
    if (await this.publishLocally(post)) {
      return;
    }
    const target = await this.resolveTarget(post);
    if (!target.fbPageId || !target.igUserId) {
      throw new PermanentError('Facebook Page id or Instagram account id is missing on the brand.');
    }
    if (!post.imageUrl?.startsWith('https://') || !post.caption || !post.cta) {
      throw new PermanentError('Publishing needs a caption and a public https image.');
    }
    const token = target.token;
    if (!token || token === UNCONFIGURED_PAGE_TOKEN) {
      throw new PermanentError('Facebook Page token is not configured.');
    }
    const imageUrl = post.imageUrl;
    const caption = formatPostText({ caption: post.caption, hashtags: post.hashtags, cta: post.cta });

    if (!post.fbPostId) {
      const fbPostId = await this.meta.publishPagePhoto({
        pageId: target.fbPageId,
        token,
        imageUrl,
        caption,
      });
      await this.posts.saveFbPostId(post.id, fbPostId);
    }

    const fresh = await this.posts.findForPipeline(postId);
    if (!fresh?.imageUrl) {
      throw new PermanentError('Post not found.');
    }
    if (!fresh.igMediaId) {
      let containerId = fresh.igContainerId;
      if (!containerId) {
        containerId = await this.meta.createImageContainer({
          igUserId: target.igUserId,
          token,
          imageUrl: fresh.imageUrl,
          caption,
        });
        await this.posts.saveIgContainerId(fresh.id, containerId);
      }
      await this.meta.waitUntilFinished(containerId, token);
      const igMediaId = await this.meta.publishContainer({
        igUserId: target.igUserId,
        token,
        containerId,
      });
      await this.posts.saveIgMediaId(fresh.id, igMediaId);
    }
  }

  private async resolveTarget(post: { userId: string; brand: { fbPageId: string; igUserId: string; pageAccessTokenEnc: string } }): Promise<{
    fbPageId: string;
    igUserId: string;
    token: string;
  }> {
    const accounts = await this.prisma.connectedAccount.findMany({ where: { userId: post.userId } });
    const facebook = accounts.find((account) => account.platform === 'facebook');
    const instagram = accounts.find((account) => account.platform === 'instagram');
    const tokenEnc = facebook?.tokenEnc || post.brand.pageAccessTokenEnc;
    return {
      fbPageId: facebook?.externalId || post.brand.fbPageId,
      igUserId: instagram?.externalId || post.brand.igUserId,
      token: tokenEnc ? this.cipher.decrypt(tokenEnc) : '',
    };
  }

  private async publishLocally(post: { id: string; fbPostId: string | null; igMediaId: string | null; brand: { pageAccessTokenEnc: string } }): Promise<boolean> {
    if (!this.config.env.localDev) {
      return false;
    }
    const token = this.cipher.decrypt(post.brand.pageAccessTokenEnc);
    if (token && token !== UNCONFIGURED_PAGE_TOKEN) {
      return false;
    }
    if (!post.fbPostId) {
      await this.posts.saveFbPostId(post.id, `local-fb-${post.id}`);
    }
    if (!post.igMediaId) {
      await this.posts.saveIgMediaId(post.id, `local-ig-${post.id}`);
    }
    return true;
  }
}
