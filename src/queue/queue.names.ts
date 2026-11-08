export const INCOMING_QUEUE = 'incoming';
export const GENERATE_POST_QUEUE = 'generate-post';
export const PUBLISH_POST_QUEUE = 'publish-post';

export function jobOptions(jobId: string, delayMs: number) {
  return {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: delayMs },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  };
}
