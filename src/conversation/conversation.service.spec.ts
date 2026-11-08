import { ConversationState, PostStatus } from '@prisma/client';
import { ConversationService } from './conversation.service';
import { COPY } from '../whatsapp/copy';
import { IncomingMessage } from '../whatsapp/parse-webhook';

type StoredPost = {
  id: string;
  userId: string;
  brandId: string;
  brief: string;
  sourceMessageId: string;
  revisionMessageId: string | null;
  status: PostStatus;
};

function text(id: string, body: string): IncomingMessage {
  return { messageId: id, from: '+1 (555) 123-0000', name: 'Lina', kind: 'text', text: body };
}

function button(id: string, buttonId: string): IncomingMessage {
  return { messageId: id, from: '15551230000', kind: 'button', buttonId };
}

describe('ConversationService', () => {
  const posts = new Map<string, StoredPost>();
  const conversations = new Map<string, { userId: string; state: ConversationState; activePostId: string | null }>();
  let sequence = 0;
  const whatsapp = { markRead: jest.fn(), sendText: jest.fn() };
  const generateQueue = { add: jest.fn() };
  const publishQueue = { add: jest.fn() };
  const brands = { findFirst: jest.fn(async (): Promise<{ id: string } | null> => ({ id: 'brand_1' })) };
  const prisma = {
    user: {
      upsert: jest.fn(async ({ where, create }: { where: { phone: string }; create: { phone: string; name?: string } }) => ({
        id: 'user_1',
        phone: where.phone,
        name: create.name ?? null,
        createdAt: new Date(),
      })),
    },
    conversation: {
      upsert: jest.fn(async ({ where, create }: { where: { userId: string }; create: { userId: string; state: ConversationState } }) => {
        const existing = conversations.get(where.userId);
        if (existing) {
          return { id: 'conv_1', updatedAt: new Date(), ...existing };
        }
        const created = { userId: create.userId, state: create.state, activePostId: null as string | null };
        conversations.set(create.userId, created);
        return { id: 'conv_1', updatedAt: new Date(), ...created };
      }),
      update: jest.fn(async ({ where, data }: { where: { userId: string }; data: Partial<{ state: ConversationState; activePostId: string | null }> }) => {
        const row = conversations.get(where.userId);
        if (!row) {
          throw new Error('missing conversation');
        }
        Object.assign(row, data);
        return row;
      }),
    },
  };
  const postsService = {
    findBySourceMessageId: jest.fn(async (sourceMessageId: string) => {
      return [...posts.values()].find((post) => post.sourceMessageId === sourceMessageId) ?? null;
    }),
    createGenerating: jest.fn(async (input: Omit<StoredPost, 'id' | 'revisionMessageId' | 'status'>) => {
      sequence += 1;
      const post: StoredPost = { id: `post_${sequence}`, revisionMessageId: null, status: PostStatus.generating, ...input };
      posts.set(post.id, post);
      return post;
    }),
    findById: jest.fn(async (id: string) => posts.get(id) ?? null),
    beginRevision: jest.fn(async (id: string, revisionMessageId: string) => {
      const post = posts.get(id);
      if (!post) {
        throw new Error('missing post');
      }
      post.revisionMessageId = revisionMessageId;
      post.status = PostStatus.generating;
      return post;
    }),
    markApproved: jest.fn(async (id: string) => {
      const post = posts.get(id);
      if (!post || post.status !== PostStatus.draft) {
        return false;
      }
      post.status = PostStatus.approved;
      return true;
    }),
    cancelIfOpen: jest.fn(async (id: string) => {
      const post = posts.get(id);
      const openStatuses: PostStatus[] = [PostStatus.generating, PostStatus.draft, PostStatus.approved];
      if (!post || !openStatuses.includes(post.status)) {
        return false;
      }
      post.status = PostStatus.cancelled;
      return true;
    }),
  };

  const service = new ConversationService(
    prisma as never,
    postsService as never,
    brands as never,
    whatsapp as never,
    { env: { allowlist: new Set(['15551230000']) } } as never,
    generateQueue as never,
    publishQueue as never,
  );

  beforeEach(() => {
    posts.clear();
    conversations.clear();
    sequence = 0;
    jest.clearAllMocks();
    brands.findFirst.mockResolvedValue({ id: 'brand_1' });
  });

  it('refuses a number that is not on the allowlist', async () => {
    await service.handle({ messageId: 'wamid.x', from: '1999', kind: 'text', text: 'hi' });
    expect(whatsapp.sendText).toHaveBeenCalledWith('1999', COPY.refusal);
    expect(postsService.createGenerating).not.toHaveBeenCalled();
  });

  it('turns an idle brief into one generate job', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    await service.handle(text('wamid.1', '20% off whitening'));
    expect(postsService.createGenerating).toHaveBeenCalledTimes(1);
    expect(generateQueue.add).toHaveBeenCalledWith(
      'generate',
      { postId: 'post_1', revision: undefined },
      expect.objectContaining({ jobId: 'generate:wamid.1' }),
    );
    expect(conversations.get('user_1')?.state).toBe(ConversationState.generating);
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.creating);
  });

  it('does not start a second draft while one is generating', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    await service.handle(text('wamid.2', 'another offer'));
    expect(postsService.createGenerating).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.stillWorking);
  });

  it('asks for a button tap while a draft is waiting', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    conversations.get('user_1')!.state = ConversationState.awaiting_approval;
    await service.handle(text('wamid.2', 'approve it'));
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.tapButtons);
  });

  it('regenerates once when the edit reply arrives', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    const post = posts.get('post_1')!;
    post.status = PostStatus.draft;
    conversations.get('user_1')!.state = ConversationState.awaiting_approval;
    await service.handle(button('wamid.2', 'edit:post_1'));
    expect(conversations.get('user_1')?.state).toBe(ConversationState.awaiting_edit);
    await service.handle(text('wamid.3', 'mention Friday'));
    await service.handle(text('wamid.3', 'mention Friday'));
    expect(postsService.beginRevision).toHaveBeenCalledTimes(1);
    expect(generateQueue.add).toHaveBeenCalledWith(
      'generate',
      { postId: 'post_1', revision: 'mention Friday' },
      expect.objectContaining({ jobId: 'generate:wamid.3' }),
    );
  });

  it('approves a draft once and ignores a second tap', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    posts.get('post_1')!.status = PostStatus.draft;
    await service.handle(button('wamid.2', 'approve:post_1'));
    await service.handle(button('wamid.3', 'approve:post_1'));
    expect(posts.get('post_1')?.status).toBe(PostStatus.approved);
    expect(publishQueue.add).toHaveBeenCalledTimes(2);
    expect(publishQueue.add).toHaveBeenCalledWith(
      'publish',
      { postId: 'post_1' },
      expect.objectContaining({ jobId: 'publish:post_1' }),
    );
    expect(whatsapp.sendText.mock.calls.filter((call) => call[1] === COPY.publishing)).toHaveLength(1);
  });

  it('cancels the active draft and ignores a stale button', async () => {
    await service.handle(text('wamid.1', '20% off whitening'));
    posts.get('post_1')!.status = PostStatus.draft;
    await service.handle(button('wamid.2', 'cancel:other'));
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.stale);
    await service.handle(button('wamid.3', 'cancel:post_1'));
    expect(posts.get('post_1')?.status).toBe(PostStatus.cancelled);
    expect(conversations.get('user_1')).toMatchObject({ state: ConversationState.idle, activePostId: null });
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.cancelled);
  });

  it('tells the user when the brand row is missing', async () => {
    brands.findFirst.mockResolvedValue(null);
    await service.handle(text('wamid.1', '20% off whitening'));
    expect(postsService.createGenerating).not.toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('15551230000', COPY.noBrand);
  });
});
