import { PostStatus } from '@prisma/client';
import { PermanentError } from '../common/errors';

export type PublishStep = 'claim' | 'resume' | 'confirm' | 'stop';

export function nextPublishStep(post: {
  status: PostStatus;
  fbPostId: string | null;
  igMediaId: string | null;
}): PublishStep {
  if (post.status === PostStatus.published) {
    return 'confirm';
  }
  if (post.status === PostStatus.draft || post.status === PostStatus.approved) {
    return 'claim';
  }
  if (post.status === PostStatus.publishing) {
    return post.fbPostId && post.igMediaId ? 'confirm' : 'resume';
  }
  return 'stop';
}

export function readContainerStatus(body: unknown): 'pending' | 'finished' | 'error' {
  const record = asRecord(body);
  const code = stringValue(record.status_code).toUpperCase();
  if (code === 'FINISHED' || code === 'PUBLISHED') {
    return 'finished';
  }
  if (code === 'ERROR' || code === 'EXPIRED') {
    return 'error';
  }
  return 'pending';
}

export function readPhotoPostId(body: unknown): string {
  const record = asRecord(body);
  if (typeof record.post_id === 'string' && record.post_id) {
    return record.post_id;
  }
  if (typeof record.id === 'string' && record.id) {
    return record.id;
  }
  throw new PermanentError('Facebook did not return a post id.');
}

export function readGraphId(body: unknown): string {
  const record = asRecord(body);
  if (typeof record.id === 'string' && record.id) {
    return record.id;
  }
  throw new PermanentError('Meta did not return an id.');
}

export function publishFailureText(post: { fbPostId: string | null; igMediaId: string | null }, message: string): string {
  if (post.fbPostId && !post.igMediaId) {
    return `Facebook published, but Instagram failed. ${message}`;
  }
  return `Couldn't publish that post. ${message}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
