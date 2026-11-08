import { loadConfig } from './load-config';

const baseEnv = {
  DATABASE_URL: 'postgresql://localhost/autopost',
  REDIS_URL: 'redis://localhost:6379',
  APP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ADMIN_API_KEY: 'admin',
  WHATSAPP_APP_SECRET: 'secret',
  WHATSAPP_VERIFY_TOKEN: 'verify',
  WHATSAPP_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: '123',
  ALLOWLIST_PHONES: '+1 (555) 123-0000, 15559990000',
};

describe('loadConfig', () => {
  it('normalizes the phone allowlist and selects local storage', () => {
    const env = loadConfig(baseEnv);
    expect(env.allowlist.has('15551230000')).toBe(true);
    expect(env.allowlist.has('15559990000')).toBe(true);
    expect(env.storageDriver).toBe('local');
    expect(env.encryptionKey).toHaveLength(32);
  });

  it('uses Azure Blob when a connection string is present', () => {
    const env = loadConfig({ ...baseEnv, AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true' });
    expect(env.storageDriver).toBe('azure');
  });

  it('names every missing required variable', () => {
    expect(() => loadConfig({})).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it('uses SQLite and the in-process queue when Redis and WhatsApp are unset', () => {
    const env = loadConfig({
      APP_ENCRYPTION_KEY: baseEnv.APP_ENCRYPTION_KEY,
    });
    expect(env.databaseUrl).toBe('file:../data/autopost.db');
    expect(env.queueDriver).toBe('local');
    expect(env.whatsappTransport).toBe('local');
    expect(env.localDev).toBe(true);
    expect(env.storageDriver).toBe('local');
  });

  it('closes local dev routes when LOCAL_DEV is false', () => {
    const env = loadConfig({
      APP_ENCRYPTION_KEY: baseEnv.APP_ENCRYPTION_KEY,
      LOCAL_DEV: 'false',
    });
    expect(env.localDev).toBe(false);
    expect(env.whatsappTransport).toBe('local');
  });
});
