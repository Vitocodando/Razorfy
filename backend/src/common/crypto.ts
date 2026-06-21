import crypto from 'crypto';
import { config } from '../config';
import { BusinessError } from './BusinessError';

// Criptografia simétrica em repouso (AES-256-GCM) para o segredo TOTP (NFR FEAT-076).
// Formato armazenado (base64): iv(12) | authTag(16) | ciphertext.
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  if (!config.TOTP_ENC_KEY) {
    throw new BusinessError('TWO_FA_UNAVAILABLE', 'Autenticação em duas etapas não está configurada neste ambiente.', 503);
  }
  return Buffer.from(config.TOTP_ENC_KEY, 'hex');
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
