import { PostStatus } from '@prisma/client';
import { PermanentError } from '../common/errors';
import { GenerateProcessor } from './generate.processor';

type StoredDraft = {
  id: string;
  userId: string;
  brandId: string;
  brief: string;
  sourceMessageId: string;
  revisionMessageId: string | null;
  headline: string | null;
  caption: string | null;
  hashtags: string[];
  cta: string | null;
  canvaDesignId: string | null;
  imageUrl: string | null;
  previewSent: boolean;
  status: PostStatus;
  fbPostId: string | null;
  igContainerId: string | null;
  igMediaId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; phone: string; name: string; createdAt: Date };
  brand: {
    id: string;
    name: string;
    tone: string;
    audience: string;
    canvaBrandTemplateId: string;
    fbPageId: string;
    igUserId: string;
    pageAccessTokenEnc: string;
    createdAt: Date;
  };
};

const brand = {
  id: 'brand_1',
  name: 'Smile Dental',
  tone: 'Warm',
  audience: 'Adults 25-50',
  canvaBrandTemplateId: 'template_1',
  fbPageId: 'page',
  igUserId: 'ig',
  pageAccessTokenEnc: 'enc',
  createdAt: new Date(),
};

function pipeline(overrides: Partial<StoredDraft> = {}): StoredDraft {
  return {
    id: 'post_1',
    userId: 'user_1',
    brandId: 'brand_1',
    brief: '20% off whitening',
    sourceMessageId: 'wamid.1',
    revisionMessageId: null,
    headline: null,
    caption: null,
    hashtags: [],
    cta: null,
    canvaDesignId: null,
    imageUrl: null,
    previewSent: false,
    status: PostStatus.generating,
    fbPostId: null,
    igContainerId: null,
    igMediaId: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user_1', phone: '15551230000', name: 'Lina', createdAt: new Date() },
    brand,
    ...overrides,
  };
}

describe('GenerateProcessor', () => {
  const stored = new Map<string, StoredDraft>();
  const posts = {
    findForPipeline: jest.fn(async (id: string) => stored.get(id) ?? null),
    findById: jest.fn(async (id: string) => stored.get(id) ?? null),
    saveCopy: jest.fn(async (id: string, copy: { headline: string; caption: string; hashtags: string[]; cta: string }) => {
      stored.set(id, { ...stored.get(id)!, ...copy });
    }),
    saveDesign: jest.fn(async (id: string, design: { designId: string; imageUrl: string }) => {
      stored.set(id, { ...stored.get(id)!, canvaDesignId: design.designId, imageUrl: design.imageUrl });
    }),
    markDraft: jest.fn(async (id: string) => {
      const post = stored.get(id);
      if (!post || post.status !== PostStatus.generating) {
        return false;
      }
      stored.set(id, { ...post, status: PostStatus.draft });
      return true;
    }),
    markPreviewSent: jest.fn(async (id: string) => {
      stored.set(id, { ...stored.get(id)!, previewSent: true });
    }),
    markFailed: jest.fn(),
  };
  const content = { generate: jest.fn() };
  const design = { isConfigured: jest.fn(), createImage: jest.fn(), createLocalPreview: jest.fn() };
  const whatsapp = { sendDraftPreview: jest.fn(), sendText: jest.fn() };
  const prisma = {
    conversation: {
      update: jest.fn(),
      findUnique: jest.fn(async () => ({ activePostId: 'post_1', userId: 'user_1' })),
    },
  };
  const processor = new GenerateProcessor(posts as never, content as never, design as never, whatsapp as never, prisma as never);

  beforeEach(() => {
    stored.clear();
    jest.clearAllMocks();
    content.generate.mockResolvedValue({
      headline: 'Whiter smile',
      caption: '20% off whitening this week.',
      hashtags: ['#whitening'],
      cta: 'Book now',
    });
    design.isConfigured.mockResolvedValue(false);
    design.createLocalPreview.mockResolvedValue(null);
  });

  it('sends a text preview when Canva is not connected', async () => {
    stored.set('post_1', pipeline());
    await processor.process({ data: { postId: 'post_1' } } as never);
    expect(content.generate).toHaveBeenCalledTimes(1);
    expect(design.createImage).not.toHaveBeenCalled();
    expect(whatsapp.sendDraftPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '15551230000',
        postId: 'post_1',
        body: expect.stringContaining('20% off whitening this week.'),
      }),
    );
    expect(stored.get('post_1')?.status).toBe(PostStatus.draft);
  });

  it('fills the Canva template once copy already exists', async () => {
    stored.set(
      'post_1',
      pipeline({
        headline: 'Whiter smile',
        caption: '20% off whitening this week.',
        hashtags: ['#whitening'],
        cta: 'Book now',
      }),
    );
    design.isConfigured.mockResolvedValue(true);
    design.createImage.mockResolvedValue({ designId: 'design_1', imageUrl: 'https://cdn.example/post_1.jpg' });
    await processor.process({ data: { postId: 'post_1' } } as never);
    expect(content.generate).not.toHaveBeenCalled();
    expect(design.createImage).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'template_1', headline: 'Whiter smile' }),
    );
    expect(whatsapp.sendDraftPreview).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://cdn.example/post_1.jpg' }),
    );
  });

  it('stops when the draft was cancelled and reports a permanent Claude failure', async () => {
    stored.set('post_1', pipeline({ status: PostStatus.cancelled }));
    await processor.process({ data: { postId: 'post_1' } } as never);
    expect(content.generate).not.toHaveBeenCalled();

    stored.set('post_1', pipeline());
    content.generate.mockRejectedValue(new PermanentError('ANTHROPIC_API_KEY is not configured.'));
    await processor.process({ data: { postId: 'post_1' } } as never);
    expect(posts.markFailed).toHaveBeenCalledWith('post_1', 'ANTHROPIC_API_KEY is not configured.');
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', expect.stringContaining('ANTHROPIC_API_KEY'));
  });
});
