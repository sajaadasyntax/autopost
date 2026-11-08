import { LocalQueueRegistry } from './local-queue';

describe('LocalQueueRegistry', () => {
  it('runs a job once and ignores a duplicate job id', async () => {
    const registry = new LocalQueueRegistry();
    const seen: string[] = [];
    registry.bind('generate-post', {
      run: async (job) => {
        seen.push((job.data as { postId: string }).postId);
      },
    });
    const queue = registry.port('generate-post');
    await queue.add('generate', { postId: 'post_1' }, { jobId: 'generate:1', attempts: 2 });
    await queue.add('generate', { postId: 'post_1' }, { jobId: 'generate:1', attempts: 2 });
    expect(seen).toEqual(['post_1']);
  });

  it('retries and then reports the last failure', async () => {
    const registry = new LocalQueueRegistry();
    const failures: number[] = [];
    registry.bind('publish-post', {
      run: async () => {
        throw new Error('down');
      },
      onFailed: async (job) => {
        failures.push(job.attemptsMade);
      },
    });
    await registry.port('publish-post').add('publish', { postId: 'post_1' }, { attempts: 2, backoff: { type: 'exponential', delay: 1 } });
    expect(failures).toEqual([2]);
  });
});
