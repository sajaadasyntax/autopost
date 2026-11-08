import { HttpError } from './errors';

export async function requestJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new HttpError(readError(body, response.status), response.status);
  }
  return { status: response.status, body };
}

export async function requestBuffer(url: string, timeoutMs = 60_000): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new HttpError(`Download failed with status ${response.status}`, response.status);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function pollUntil<T>(
  read: () => Promise<T | undefined>,
  options: { attempts: number; delayMs: number },
): Promise<T> {
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const value = await read();
    if (value !== undefined) {
      return value;
    }
    if (attempt < options.attempts - 1) {
      await delay(options.delayMs);
    }
  }
  throw new HttpError('Timed out waiting for an upstream job', 504);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as { error?: { message?: string } | string; message?: string };
    if (typeof record.error === 'string' && record.error) {
      return record.error;
    }
    if (record.error && typeof record.error === 'object' && typeof record.error.message === 'string') {
      return record.error.message;
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }
  return `Request failed with status ${status}`;
}
