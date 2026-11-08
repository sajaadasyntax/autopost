import { decryptString, encryptString } from '../crypto/token-cipher';

type OauthState = { verifier: string; exp: number };

export function sealOauthState(state: OauthState, key: Buffer): string {
  return encryptString(JSON.stringify(state), key);
}

export function openOauthState(payload: string, key: Buffer): OauthState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decryptString(payload, key)) as unknown;
  } catch {
    throw new Error('Canva state could not be verified.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Canva state could not be verified.');
  }
  const record = parsed as Partial<OauthState>;
  if (typeof record.verifier !== 'string' || typeof record.exp !== 'number') {
    throw new Error('Canva state could not be verified.');
  }
  if (record.exp < Date.now()) {
    throw new Error('Canva authorization expired. Start the connect flow again.');
  }
  return { verifier: record.verifier, exp: record.exp };
}
