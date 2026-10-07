import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createDecipheriv, randomBytes } from 'node:crypto';
import { EncryptionService } from './encryption.service';
import type { EncryptedValue } from './encryption.service';

describe('EncryptionService', () => {
  let module: TestingModule;
  let service: EncryptionService;
  let testKey: string;
  const getConfig = jest.fn();
  const decryptionError = 'Encrypted value could not be decrypted.';

  beforeEach(async () => {
    // Isolated random test material; never read the application's environment key.
    testKey = randomBytes(32).toString('base64');
    getConfig
      .mockReset()
      .mockImplementation((name: string) =>
        name === 'AES_MASTER_KEY' ? testKey : undefined,
      );
    module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: { get: getConfig } },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: getConfig })
      .compile();
    service = module.get(EncryptionService);
  });

  afterEach(async () => {
    await module.close();
  });

  function tamper(base64: string): string {
    const bytes = Buffer.from(base64, 'base64');
    bytes[0] ^= 1;
    return bytes.toString('base64');
  }

  it('round-trips a generated sample key without storing its plaintext', () => {
    const sampleKey = service.generateRandomKey();
    const encrypted = service.encrypt(sampleKey);

    expect(Object.keys(encrypted).sort()).toEqual([
      'authTag',
      'ciphertext',
      'iv',
    ]);
    expect(encrypted.ciphertext).not.toBe(sampleKey);
    expect(service.decrypt(encrypted)).toBe(sampleKey);
    expect(getConfig).toHaveBeenCalledWith('AES_MASTER_KEY');
  });

  it('uses AES-256-GCM with a 12-byte IV and 16-byte tag', () => {
    const encrypted = service.encrypt('sample key material');
    expect(Buffer.from(encrypted.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(encrypted.authTag, 'base64')).toHaveLength(16);
    for (const value of Object.values(encrypted)) {
      expect(Buffer.from(value, 'base64').toString('base64')).toBe(value);
    }

    // Independently decrypt with Node's API to verify the storage representation.
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(testKey, 'base64'),
      Buffer.from(encrypted.iv, 'base64'),
      { authTagLength: 16 },
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    expect(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8'),
    ).toBe('sample key material');
  });

  it('uses a different random IV and ciphertext for repeated plaintext', () => {
    const first = service.encrypt('same data');
    const second = service.encrypt('same data');
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(service.decrypt(first)).toBe('same data');
    expect(service.decrypt(second)).toBe('same data');
  });

  it.each(['ciphertext', 'iv', 'authTag'] as const)(
    'rejects a tampered %s even with valid Base64 and length',
    (field) => {
      const encrypted = service.encrypt('secret sample material');
      encrypted[field] = tamper(encrypted[field]);
      expect(() => service.decrypt(encrypted)).toThrow(decryptionError);
    },
  );

  it('rejects a different valid 32-byte master key', () => {
    const encrypted = service.encrypt('secret sample material');
    getConfig.mockReturnValue(randomBytes(32).toString('base64'));
    expect(() => service.decrypt(encrypted)).toThrow(decryptionError);
  });

  it.each(['Mabuhay! café 日本語 🔐\u0000\n', ''])(
    'round-trips Unicode and empty strings: %j',
    (plaintext) => {
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
      if (plaintext === '') {
        expect(encrypted.ciphertext).toBe('');
        expect(Buffer.from(encrypted.authTag, 'base64')).toHaveLength(16);
        expect(() => service.decrypt({ ...encrypted, authTag: '' })).toThrow(
          decryptionError,
        );
      }
    },
  );

  it.each(['ciphertext', 'iv', 'authTag'] as const)(
    'rejects malformed or missing %s without disclosing input',
    (field) => {
      const encrypted = service.encrypt('private input');
      for (const invalid of ['not!base64', ' ', 'AB==', undefined, null, 12]) {
        expect(() =>
          service.decrypt({ ...encrypted, [field]: invalid }),
        ).toThrow(new Error(decryptionError));
      }
    },
  );

  it.each([0, 1, 11, 13, 16])('rejects a %i-byte IV', (length) => {
    const encrypted = service.encrypt('secret');
    encrypted.iv = randomBytes(length).toString('base64');
    expect(() => service.decrypt(encrypted)).toThrow(decryptionError);
  });

  it.each([0, 1, 4, 12, 15, 17])('rejects a %i-byte tag', (length) => {
    const encrypted = service.encrypt('secret');
    encrypted.authTag = Buffer.from(encrypted.authTag, 'base64')
      .subarray(0, length)
      .toString('base64');
    if (length > 16) encrypted.authTag = randomBytes(length).toString('base64');
    expect(() => service.decrypt(encrypted)).toThrow(decryptionError);
  });

  it('rejects missing payloads and truncated ciphertext', () => {
    for (const invalid of [undefined, null, {}]) {
      expect(() => service.decrypt(invalid as EncryptedValue)).toThrow(
        decryptionError,
      );
    }
    const encrypted = service.encrypt('secret');
    expect(() => service.decrypt({ ...encrypted, ciphertext: '' })).toThrow(
      decryptionError,
    );
    encrypted.ciphertext = Buffer.from(encrypted.ciphertext, 'base64')
      .subarray(1)
      .toString('base64');
    expect(() => service.decrypt(encrypted)).toThrow(decryptionError);
  });

  it.each([undefined, null, ''])(
    'rejects a missing master key (%j) on use',
    (key) => {
      const encrypted = service.encrypt('secret');
      getConfig.mockReturnValue(key);
      expect(
        () => new EncryptionService(module.get(ConfigService)),
      ).not.toThrow();
      expect(() => service.encrypt('secret')).toThrow(
        'AES master key is not configured.',
      );
      expect(() => service.decrypt(encrypted)).toThrow(
        'AES master key is not configured.',
      );
    },
  );

  it('strictly rejects malformed Base64 master keys without echoing them', () => {
    const encrypted = service.encrypt('secret');
    const noncanonical =
      testKey.slice(0, -2) +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(
          testKey.at(-2)!,
        ) + 1
      ] +
      '=';
    for (const invalid of [
      'invalid!secret',
      `${testKey}\n`,
      testKey.slice(0, -1),
      `${testKey}=`,
      noncanonical,
      123,
    ]) {
      getConfig.mockReturnValue(invalid);
      const error = new Error('AES master key must be valid canonical Base64.');
      expect(() => service.encrypt('secret')).toThrow(error);
      expect(() => service.decrypt(encrypted)).toThrow(error);
    }
  });

  it.each([1, 16, 24, 31, 33, 64])('rejects a %i-byte master key', (length) => {
    const encrypted = service.encrypt('secret');
    getConfig.mockReturnValue(randomBytes(length).toString('base64'));
    const error = 'AES master key must decode to exactly 32 bytes.';
    expect(() => service.encrypt('secret')).toThrow(error);
    expect(() => service.decrypt(encrypted)).toThrow(error);
  });

  it('generates independent 32-byte Base64 sample keys without reading configuration', () => {
    getConfig.mockReturnValue(undefined);
    const first = service.generateRandomKey();
    const second = service.generateRandomKey();
    expect(Buffer.from(first, 'base64')).toHaveLength(32);
    expect(Buffer.from(first, 'base64').toString('base64')).toBe(first);
    expect(Buffer.from(second, 'base64')).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(getConfig).not.toHaveBeenCalled();
  });

  it('rejects non-string plaintext without coercing it', () => {
    expect(() => service.encrypt(null as unknown as string)).toThrow(
      'Encryption plaintext must be a string.',
    );
  });
});
