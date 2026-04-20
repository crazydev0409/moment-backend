import crypto from 'crypto';
import { calendarEncryptionSecret } from '../config/config';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  return crypto.createHash('sha256').update(calendarEncryptionSecret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getKey(), iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    content: encrypted.toString('base64'),
  });
}

export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) {
    return null;
  }

  const parsed = JSON.parse(payload) as {
    iv: string;
    authTag: string;
    content: string;
  };

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getKey(),
    Buffer.from(parsed.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}
