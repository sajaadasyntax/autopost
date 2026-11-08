import { Injectable } from '@nestjs/common';
import { PermanentError } from '../common/errors';
import { pollUntil, requestJson } from '../common/http';
import { AppConfigService } from '../config/app-config.service';
import { readContainerStatus, readGraphId, readPhotoPostId } from './publish-step';

@Injectable()
export class MetaService {
  constructor(private readonly config: AppConfigService) {}

  async publishPagePhoto(input: { pageId: string; token: string; imageUrl: string; caption: string }): Promise<string> {
    const { body } = await requestJson(this.url(`${input.pageId}/photos`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: input.imageUrl,
        caption: input.caption,
        published: true,
        access_token: input.token,
      }),
    });
    return readPhotoPostId(body);
  }

  async createImageContainer(input: {
    igUserId: string;
    token: string;
    imageUrl: string;
    caption: string;
  }): Promise<string> {
    const { body } = await requestJson(this.url(`${input.igUserId}/media`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: input.imageUrl,
        caption: input.caption,
        access_token: input.token,
      }),
    });
    return readGraphId(body);
  }

  async waitUntilFinished(containerId: string, token: string): Promise<void> {
    await pollUntil(
      async () => {
        const { body } = await requestJson(this.url(containerId, { fields: 'status_code', access_token: token }));
        const status = readContainerStatus(body);
        if (status === 'error') {
          throw new PermanentError('Instagram rejected the image.');
        }
        return status === 'finished' ? true : undefined;
      },
      { attempts: 20, delayMs: 3000 },
    );
  }

  async publishContainer(input: { igUserId: string; token: string; containerId: string }): Promise<string> {
    const { body } = await requestJson(this.url(`${input.igUserId}/media_publish`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: input.containerId, access_token: input.token }),
    });
    return readGraphId(body);
  }

  private url(path: string, query: Record<string, string> = {}): string {
    const url = new URL(`https://graph.facebook.com/${this.config.env.graphVersion}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
