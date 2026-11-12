import { parseEncryptionKey } from '../crypto/token-cipher';
import { parseAllowlist } from '../common/phones';
import { AppEnv } from './app-env';

const REQUIRED = ['APP_ENCRYPTION_KEY'] as const;

function readFlag(value: string | undefined, fallback: boolean): boolean {
  const text = value?.trim().toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppEnv {
  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const connectionString = env.AZURE_STORAGE_CONNECTION_STRING?.trim() ?? '';
  const port = Number(env.PORT ?? 3000);
  const redisUrl = env.REDIS_URL?.trim() ?? '';
  const whatsappToken = env.WHATSAPP_TOKEN?.trim() ?? '';
  const localDev = readFlag(env.LOCAL_DEV, !whatsappToken);

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    databaseUrl: env.DATABASE_URL?.trim() || 'file:../data/autopost.db',
    redisUrl,
    queueDriver: redisUrl ? 'redis' : 'local',
    whatsappTransport: whatsappToken ? 'graph' : 'local',
    localDev,
    encryptionKey: parseEncryptionKey(env.APP_ENCRYPTION_KEY!),
    adminApiKey: env.ADMIN_API_KEY?.trim() || 'local-admin',
    publicBaseUrl: (env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port || 3000}`).replace(/\/$/, ''),
    studioOrigin: (env.STUDIO_ORIGIN?.trim() || 'http://127.0.0.1:3011').replace(/\/$/, ''),
    facebookAppId: env.FACEBOOK_APP_ID?.trim() ?? '',
    facebookAppSecret: env.FACEBOOK_APP_SECRET?.trim() || env.WHATSAPP_APP_SECRET?.trim() || '',
    storageDriver: connectionString ? 'azure' : 'local',
    storageDir: env.STORAGE_DIR?.trim() || 'storage',
    blobContainer: env.AZURE_BLOB_CONTAINER?.trim() || 'post-images',
    azureStorageConnectionString: connectionString,
    allowlist: parseAllowlist(env.ALLOWLIST_PHONES),
    whatsappToken,
    whatsappPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim() || 'local',
    whatsappAppSecret: env.WHATSAPP_APP_SECRET?.trim() || 'local-secret',
    whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN?.trim() || 'local-verify',
    graphVersion: env.GRAPH_API_VERSION?.trim() || 'v21.0',
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() ?? '',
    claudeModel: env.CLAUDE_MODEL?.trim() || 'claude-sonnet-4-5',
    geminiApiKey: env.GEMINI_API_KEY?.trim() ?? '',
    geminiModel: env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    canvaClientId: env.CANVA_CLIENT_ID?.trim() ?? '',
    canvaClientSecret: env.CANVA_CLIENT_SECRET?.trim() ?? '',
    canvaRedirectUri: env.CANVA_REDIRECT_URI?.trim() ?? '',
    canvaFieldHeadline: env.CANVA_FIELD_HEADLINE?.trim() || 'HEADLINE',
    canvaFieldCaption: env.CANVA_FIELD_CAPTION?.trim() || 'CAPTION',
    canvaFieldCta: env.CANVA_FIELD_CTA?.trim() || 'CTA',
  };
}
