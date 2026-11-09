import { PostStatus } from '@prisma/client';
import { PublishingService } from './publishing.service';

describe('PublishingService', () => {
  const post = {
    id: 'post_1',
    userId: 'user_1',
    brandId: 'brand_1',
    brief: '20% off whitening',
    headline: 'Whiter smile',
    caption: '20% off whitening this week.',
    hashtags: ['#whitening'],
    cta: 'Book now',
    imageUrl: 'https://cdn.example/post_1.jpg',
    status: PostStatus.publishing,
    fbPostId: 'fb_1',
    igContainerId: null,
    igMediaId: null,
    user: { phone: '15551230000' },
    brand: { fbPageId: 'page_1', igUserId: 'ig_1', pageAccessTokenEnc: 'enc' },
  };
  const posts = {
    findForPipeline: jest.fn(),
    saveFbPostId: jest.fn(),
    saveIgContainerId: jest.fn(),
    saveIgMediaId: jest.fn(),
  };
  const meta = {
    publishPagePhoto: jest.fn(),
    createImageContainer: jest.fn(async () => 'container_1'),
    waitUntilFinished: jest.fn(),
    publishContainer: jest.fn(async () => 'ig_media_1'),
  };
  const cipher = { decrypt: jest.fn(() => 'page-token') };
  const prisma = { connectedAccount: { findMany: jest.fn(async () => []) } };
  const service = new PublishingService(
    posts as never,
    meta as never,
    cipher as never,
    { env: { localDev: false } } as never,
    prisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    posts.findForPipeline.mockResolvedValue({ ...post });
  });

  it('does not create a second Facebook photo when that id is already stored', async () => {
    posts.findForPipeline.mockResolvedValueOnce({ ...post }).mockResolvedValueOnce({ ...post });
    await service.publish('post_1');
    expect(meta.publishPagePhoto).not.toHaveBeenCalled();
    expect(meta.createImageContainer).toHaveBeenCalledTimes(1);
    expect(meta.publishContainer).toHaveBeenCalledWith({
      igUserId: 'ig_1',
      token: 'page-token',
      containerId: 'container_1',
    });
    expect(posts.saveIgMediaId).toHaveBeenCalledWith('post_1', 'ig_media_1');
  });

  it('refuses to publish without a public https image', async () => {
    posts.findForPipeline.mockResolvedValue({ ...post, imageUrl: 'http://localhost:3000/media/post_1.jpg' });
    await expect(service.publish('post_1')).rejects.toThrow(/public https image/);
    expect(meta.publishPagePhoto).not.toHaveBeenCalled();
  });
});
