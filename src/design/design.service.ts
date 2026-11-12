import { Injectable } from '@nestjs/common';
import { PermanentError } from '../common/errors';
import { AppConfigService } from '../config/app-config.service';
import { CanvaService } from './canva.service';
import { parseTemplateDocument, renderTemplateSvg } from './template-document';
import { rasterizeSvg } from './template-raster';
import { MediaStorageService } from './media-storage.service';

@Injectable()
export class DesignService {
  constructor(
    private readonly canva: CanvaService,
    private readonly media: MediaStorageService,
    private readonly config: AppConfigService,
  ) {}

  isConfigured(): Promise<boolean> {
    return this.canva.isConfigured();
  }

  async createImage(input: {
    postId: string;
    templateId: string;
    headline: string;
    caption: string;
    cta: string;
  }): Promise<{ designId: string; imageUrl: string }> {
    if (!input.templateId) {
      throw new PermanentError('The brand has no Canva template id.');
    }
    const rendered = await this.canva.autofillAndExport(input);
    const imageUrl = await this.media.uploadJpeg(input.postId, rendered.bytes);
    return { designId: rendered.designId, imageUrl };
  }

  async renderTemplate(input: {
    postId: string;
    document: unknown;
    headline: string;
    caption: string;
    cta: string;
  }): Promise<{ designId: string; imageUrl: string }> {
    const svg = renderTemplateSvg(parseTemplateDocument(input.document), input);
    const imageUrl = await this.media.uploadPng(input.postId, rasterizeSvg(svg));
    return { designId: `template-${input.postId}`, imageUrl };
  }

  async createLocalPreview(input: {
    postId: string;
    headline: string;
    caption: string;
    cta: string;
  }): Promise<{ designId: string; imageUrl: string } | null> {
    if (!this.config.env.localDev) {
      return null;
    }
    const imageUrl = await this.media.uploadSvg(input.postId, previewSvg(input));
    return { designId: `local-${input.postId}`, imageUrl };
  }
}

function previewSvg(input: { headline: string; caption: string; cta: string }): string {
  const headline = escapeXml(input.headline);
  const caption = escapeXml(input.caption);
  const cta = escapeXml(input.cta);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#0B3D91"/>
  <rect x="80" y="80" width="920" height="920" rx="36" fill="#F7FBFF"/>
  <text x="140" y="280" fill="#0B3D91" font-family="Arial, sans-serif" font-size="64" font-weight="700">${headline}</text>
  <text x="140" y="420" fill="#16324F" font-family="Arial, sans-serif" font-size="36">${caption}</text>
  <rect x="140" y="820" width="360" height="90" rx="45" fill="#0B3D91"/>
  <text x="180" y="878" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="700">${cta}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
