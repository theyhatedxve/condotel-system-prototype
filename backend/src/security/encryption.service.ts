import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DECRYPTION_ERROR = 'Encrypted value could not be decrypted.';

@Injectable()
export class EncryptionService {
  constructor(private readonly configService: ConfigService) {}

  // UTF-8 plaintext; ciphertext, IV and tag use canonical padded Base64.
  // Operations return encrypted values without persisting the input text.
  encrypt(plaintext: string): EncryptedValue {
    const key = this.getMasterKey();

    if (typeof plaintext !== 'string') {
      throw new Error('Encryption plaintext must be a string.');
    }

    // Reusing an IV with the same AES-GCM key can compromise confidentiality and integrity.
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(encrypted: EncryptedValue): string {
    const key = this.getMasterKey();

    try {
      const ciphertext = this.decodeBase64(encrypted.ciphertext, DECRYPTION_ERROR);
      const iv = this.decodeBase64(encrypted.iv, DECRYPTION_ERROR);
      const authTag = this.decodeBase64(encrypted.authTag, DECRYPTION_ERROR);

      if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new Error(DECRYPTION_ERROR);
      }

      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      decipher.setAuthTag(authTag);

      // Empty ciphertext is valid for an empty string, but still requires a tag.
      // Do not return any plaintext until final() authenticates the entire value.
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(DECRYPTION_ERROR);
    }
  }

  // Returns a new per-device 32-byte key as Base64; never persists it.
  generateRandomKey(): string {
    return randomBytes(KEY_BYTES).toString('base64');
  }

  private getMasterKey(): Buffer {
    // Load on use: never generate a replacement key or require AES at startup.
    const encoded = this.configService.get<string>('AES_MASTER_KEY');

    if (encoded === undefined || encoded === null || encoded === '') {
      throw new Error('AES master key is not configured.');
    }

    const key = this.decodeBase64(
      encoded,
      'AES master key must be valid canonical Base64.',
    );

    if (key.length !== KEY_BYTES) {
      throw new Error('AES master key must decode to exactly 32 bytes.');
    }

    return key;
  }

  private decodeBase64(value: string, errorMessage: string): Buffer {
    if (typeof value !== 'string') {
      throw new Error(errorMessage);
    }

    const decoded = Buffer.from(value, 'base64');

    // Node's Base64 decoder is permissive; reject ignored characters/padding.
    if (decoded.toString('base64') !== value) {
      throw new Error(errorMessage);
    }

    return decoded;
  }
}
