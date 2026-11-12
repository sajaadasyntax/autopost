import { PostStatus } from '@prisma/client';
import { nextPublishStep, publishFailureText, readContainerStatus, readPhotoPostId } from './publish-step';

describe('publish step', () => {
  const ids = { fbPostId: null, igMediaId: null };

  it('claims a draft once and resumes a partial publish', () => {
    expect(nextPublishStep({ status: PostStatus.draft, ...ids })).toBe('claim');
    expect(nextPublishStep({ status: PostStatus.approved, ...ids })).toBe('claim');
    expect(nextPublishStep({ status: PostStatus.publishing, fbPostId: 'fb', igMediaId: null })).toBe('resume');
    expect(nextPublishStep({ status: PostStatus.published, fbPostId: 'fb', igMediaId: 'ig' })).toBe('confirm');
    expect(nextPublishStep({ status: PostStatus.cancelled, ...ids })).toBe('stop');
    expect(nextPublishStep({ status: PostStatus.failed, ...ids })).toBe('stop');
  });

  it('reads Instagram container progress and a Facebook post id', () => {
    expect(readContainerStatus({ status_code: 'IN_PROGRESS' })).toBe('pending');
    expect(readContainerStatus({ status_code: 'FINISHED' })).toBe('finished');
    expect(readContainerStatus({ status_code: 'ERROR' })).toBe('error');
    expect(readPhotoPostId({ id: 'photo', post_id: 'page_post' })).toBe('page_post');
    expect(publishFailureText({ fbPostId: 'fb', igMediaId: null }, 'timeout')).toMatch(/فيسبوك/);
  });
});
