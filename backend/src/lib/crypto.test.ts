import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  loadAadhaarKey,
  encryptAadhaar,
  decryptAadhaar,
  aadhaarLast4,
} from '@/lib/crypto.ts';

const validKeyB64 = randomBytes(32).toString('base64');
const key = loadAadhaarKey(validKeyB64);

describe('crypto: key loading', () => {
  it('accepts a valid 32-byte base64 key', () => {
    expect(loadAadhaarKey(validKeyB64).length).toBe(32);
  });

  it('rejects a key that is not 32 bytes', () => {
    const shortKey = randomBytes(16).toString('base64');
    expect(() => loadAadhaarKey(shortKey)).toThrow(/32 bytes/);
  });
});

describe('crypto: encrypt/decrypt round-trip', () => {
  const aadhaar = '123456789012';

  it('round-trips plaintext', () => {
    const enc = encryptAadhaar(aadhaar, key);
    expect(decryptAadhaar(enc, key)).toBe(aadhaar);
  });

  it('ciphertext differs from plaintext', () => {
    const enc = encryptAadhaar(aadhaar, key);
    expect(enc).not.toContain(aadhaar);
  });

  it('produces a fresh IV each call (non-deterministic ciphertext)', () => {
    expect(encryptAadhaar(aadhaar, key)).not.toBe(encryptAadhaar(aadhaar, key));
  });

  it('fails to decrypt with the wrong key', () => {
    const enc = encryptAadhaar(aadhaar, key);
    const otherKey = loadAadhaarKey(randomBytes(32).toString('base64'));
    expect(() => decryptAadhaar(enc, otherKey)).toThrow();
  });

  it('fails to decrypt tampered ciphertext', () => {
    const enc = encryptAadhaar(aadhaar, key);
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptAadhaar(tampered, key)).toThrow();
  });
});

describe('crypto: last4 derivation', () => {
  it('returns the last 4 digits', () => {
    expect(aadhaarLast4('123456789012')).toBe('9012');
  });
});
