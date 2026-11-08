export type CanvaJobRead = {
  state: 'pending' | 'success' | 'failed';
  designId?: string;
  downloadUrl?: string;
  error?: string;
};

export function readCanvaJob(body: unknown): CanvaJobRead {
  const root = asRecord(body);
  const job = root.job && typeof root.job === 'object' ? asRecord(root.job) : root;
  const status = stringValue(job.status).toLowerCase();
  const designId = findDesignId(job);
  const downloadUrl = findDownloadUrl(job);
  if (status === 'failed' || status === 'error') {
    return { state: 'failed', error: stringValue(job.error) || 'Canva job failed', designId, downloadUrl };
  }
  if (status === 'success' || status === 'completed') {
    return { state: 'success', designId, downloadUrl };
  }
  return { state: 'pending', designId, downloadUrl };
}

export function readTokenResponse(body: unknown): { accessToken: string; refreshToken: string; expiresIn: number } {
  const record = asRecord(body);
  const accessToken = stringValue(record.access_token);
  const refreshToken = stringValue(record.refresh_token);
  const expiresIn = typeof record.expires_in === 'number' ? record.expires_in : 14_400;
  if (!accessToken || !refreshToken) {
    throw new Error('Canva did not return an access token and a refresh token.');
  }
  return { accessToken, refreshToken, expiresIn };
}

function findDesignId(job: Record<string, unknown>): string | undefined {
  const result = asRecord(job.result);
  const design = asRecord(result.design ?? job.design);
  return stringValue(design.id) || stringValue(result.design_id) || undefined;
}

function findDownloadUrl(job: Record<string, unknown>): string | undefined {
  const direct = firstUrl(job.urls);
  if (direct) {
    return direct;
  }
  const result = asRecord(job.result);
  return firstUrl(result.urls);
}

function firstUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const url = value.find((item) => typeof item === 'string' && item.startsWith('https://'));
  return typeof url === 'string' ? url : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
