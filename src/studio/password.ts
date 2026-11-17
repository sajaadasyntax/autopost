import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 32;

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) {
    return Promise.resolve(false);
  }
  const expected = Buffer.from(hash, 'hex');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(expected.length === key.length && timingSafeEqual(expected, key));
    });
  });
}
