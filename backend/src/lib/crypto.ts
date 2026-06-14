import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * COMPLIANCE NOTE — Aadhaar is sensitive personal data under India's
 * Aadhaar Act 2016 and the Digital Personal Data Protection (DPDP) Act 2025.
 * It MUST be encrypted at rest, only the last-4 digits may be exposed, and the
 * plaintext must NEVER be logged. This is a hackathon DEMO with app-layer
 * AES-256-GCM and FAKE numbers — there is NO real UIDAI integration.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256

/**
 * Decode and validate the base64 AES-256 key. Fails fast if the key is not
 * exactly 32 bytes so a misconfigured key is caught at startup, not at first use.
 */
export function loadAadhaarKey(base64Key: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, 'base64');
  } catch {
    throw new Error('AADHAAR_ENC_KEY is not valid base64');
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `AADHAAR_ENC_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return key;
}

/**
 * Encrypt a plaintext Aadhaar number with AES-256-GCM.
 * Stored format: base64(iv):base64(authTag):base64(ciphertext).
 * The IV is random per call, so the same input yields different ciphertext.
 */
export function encryptAadhaar(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  );
}

/**
 * Decrypt a value produced by encryptAadhaar. Only used if plaintext is ever
 * needed server-side — profile responses expose last-4 only and never call this.
 * Throws on tampering or a wrong key (GCM auth tag verification fails).
 */
export function decryptAadhaar(stored: string, key: Buffer): string {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed Aadhaar ciphertext');
  }
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/** Derive the last 4 digits for safe display. Input must be the 12-digit value. */
export function aadhaarLast4(plain: string): string {
  return plain.slice(-4);
}
