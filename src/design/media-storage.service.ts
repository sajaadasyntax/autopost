import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(private readonly config: AppConfigService) {}

  async uploadSvg(postId: string, svg: string): Promise<string> {
    const root = resolve(process.cwd(), this.config.env.storageDir);
    await mkdir(root, { recursive: true });
    const name = `${postId}.svg`;
    await writeFile(join(root, name), svg, 'utf8');
    return `${this.config.env.publicBaseUrl}/media/${name}`;
  }

  async uploadPng(name: string, bytes: Buffer): Promise<string> {
    const safe = name.replace(/[^\w.-]/g, '');
    if (!safe) {
      throw new NotFoundException();
    }
    const root = resolve(process.cwd(), this.config.env.storageDir);
    await mkdir(root, { recursive: true });
    const fileName = `${safe}.png`;
    await writeFile(join(root, fileName), bytes);
    return `${this.config.env.publicBaseUrl}/media/${fileName}`;
  }

  async uploadJpeg(postId: string, bytes: Buffer): Promise<string> {
    if (this.config.env.storageDriver === 'azure') {
      return this.uploadAzure(postId, bytes);
    }
    return this.uploadLocal(postId, bytes);
  }

  localPath(name: string): string {
    if (!/^[\w.-]+$/.test(name)) {
      throw new NotFoundException();
    }
    const root = resolve(process.cwd(), this.config.env.storageDir);
    const file = resolve(root, name);
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (!file.startsWith(prefix)) {
      throw new NotFoundException();
    }
    return file;
  }

  private async uploadLocal(postId: string, bytes: Buffer): Promise<string> {
    const root = resolve(process.cwd(), this.config.env.storageDir);
    await mkdir(root, { recursive: true });
    const name = `${postId}.jpg`;
    await writeFile(join(root, name), bytes);
    return `${this.config.env.publicBaseUrl}/media/${name}`;
  }

  private async uploadAzure(postId: string, bytes: Buffer): Promise<string> {
    const container = await this.container();
    const blob = container.getBlockBlobClient(`${postId}.jpg`);
    await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: 'image/jpeg' } });
    return blob.url;
  }

  private async container(): Promise<ContainerClient> {
    const service = BlobServiceClient.fromConnectionString(this.config.env.azureStorageConnectionString);
    const container = service.getContainerClient(this.config.env.blobContainer);
    try {
      await container.createIfNotExists({ access: 'blob' });
    } catch {
      this.logger.warn('Public blob access was rejected. Creating a private container. Instagram cannot fetch a private URL.');
      await container.createIfNotExists();
    }
    return container;
  }
}
