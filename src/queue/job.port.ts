export const INCOMING_JOBS = Symbol('INCOMING_JOBS');
export const GENERATE_JOBS = Symbol('GENERATE_JOBS');
export const PUBLISH_JOBS = Symbol('PUBLISH_JOBS');

export type JobAddOptions = {
  jobId?: string;
  attempts?: number;
  backoff?: { type: 'exponential'; delay: number };
  removeOnComplete?: { count: number };
  removeOnFail?: { count: number };
};

export type JobPort = {
  add: (name: string, data: unknown, opts?: JobAddOptions) => Promise<void>;
};

export type LocalJob<T = unknown> = {
  data: T;
  attemptsMade: number;
  opts: { attempts: number };
};

export type LocalHandler = {
  run: (job: LocalJob) => Promise<void>;
  onFailed?: (job: LocalJob, error: Error) => Promise<void>;
};
