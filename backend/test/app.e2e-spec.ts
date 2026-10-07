import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { EncryptedValue } from '../src/security/encryption.service';

describe('Authentication and AES demo (real SQLite, Argon2id, JWT and AES)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testDirectory: string;
  let token: string;
  let userId: string;
  let encrypted: EncryptedValue;
  const password = randomBytes(24).toString('base64');
  const replacementPassword = randomBytes(24).toString('base64');
  const jwtSecret = randomBytes(32).toString('base64');
  const aesKey = randomBytes(32).toString('base64');
  const settings: Record<string, string | undefined> = {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN_SECONDS: '3600',
    AES_MASTER_KEY: aesKey,
  };
  const registration = {
    email: 'demo@example.test',
    username: 'demo',
    firstName: 'Demo',
    lastName: 'User',
    password,
  };

  beforeAll(async () => {
    // A new database inside this project keeps every real account untouched.
    testDirectory = mkdtempSync(join(process.cwd(), '.test-data-'));
    // The installed SQLite schema engine expects the database file to exist.
    writeFileSync(join(testDirectory, 'test.db'), '', { flag: 'wx' });
    settings.DATABASE_URL =
      'file:' + join(testDirectory, 'test.db').replaceAll('\\', '/');
    execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        'prisma7.config.ts',
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: settings.DATABASE_URL },
        stdio: 'pipe',
      },
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        get: (name: string) => settings[name],
        getOrThrow: (name: string) => {
          if (!settings[name]) throw new Error('Missing test configuration.');
          return settings[name];
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    if (testDirectory) {
      const projectRoot = realpathSync(process.cwd());
      const target = realpathSync(testDirectory);
      if (
        !target.startsWith(projectRoot + sep) ||
        !resolve(target).includes('.test-data-')
      ) {
        throw new Error('Refusing cleanup outside the test directory.');
      }
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('registers an account with an Argon2id hash and excludes the hash from the response', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(registration)
      .expect(201);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    userId = response.body.user.id as string;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(user.passwordHash, password)).toBe(true);
    expect(user.passwordHash).not.toBe(password);
  });

  it('rejects duplicate accounts and attempts to register an elevated role', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(registration)
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...registration, role: 'ADMIN' })
      .expect(400);
  });

  it('rejects incorrect passwords and inactive accounts', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: registration.email, password: replacementPassword })
      .expect(401);
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: registration.email, password })
      .expect(401);
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
  });

  it('logs in by normalized username and email, returns a signed JWT and restores the current user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: ' DEMO ', password })
      .expect(200);
    token = response.body.accessToken as string;
    expect(
      new JwtService({ secret: jwtSecret }).verify<{ sub: string }>(token).sub,
    ).toBe(userId);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: ' DEMO@EXAMPLE.TEST ', password })
      .expect(200);
    const current = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(current.body.user.id).toBe(userId);
    expect(current.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects missing, expired and forged tokens on protected endpoints', async () => {
    const expired = new JwtService({ secret: jwtSecret }).sign(
      { sub: userId },
      { expiresIn: -1 },
    );
    const forged = new JwtService({
      secret: randomBytes(32).toString('base64'),
    }).sign({ sub: userId });
    for (const endpoint of [
      '/api/auth/me',
      '/api/security/encrypt-demo',
      '/api/security/decrypt-demo',
    ]) {
      const method = endpoint.endsWith('/me') ? 'get' : 'post';
      await request(app.getHttpServer())[method](endpoint).expect(401);
      for (const invalid of [expired, forged]) {
        await request(app.getHttpServer())
          [method](endpoint)
          .auth(invalid, { type: 'bearer' })
          .expect(401);
      }
    }
  });

  it('encrypts with a random IV and never returns the master key', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/security/encrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ text: 'Condotel \u{1f510}' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/api/security/encrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ text: 'Condotel \u{1f510}' })
      .expect(200);
    encrypted = first.body as EncryptedValue;
    expect(Object.keys(encrypted).sort()).toEqual([
      'authTag',
      'ciphertext',
      'iv',
    ]);
    expect(Buffer.from(encrypted.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(encrypted.authTag, 'base64')).toHaveLength(16);
    expect(second.body.iv).not.toBe(encrypted.iv);
    expect(JSON.stringify(encrypted)).not.toContain(aesKey);
  });

  it('decrypts the original UTF-8 text and accepts an authenticated empty string', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/security/decrypt-demo')
      .auth(token, { type: 'bearer' })
      .send(encrypted)
      .expect(200);
    expect(response.body).toEqual({ text: 'Condotel \u{1f510}' });
    const empty = await request(app.getHttpServer())
      .post('/api/security/encrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ text: '' })
      .expect(200);
    const decrypted = await request(app.getHttpServer())
      .post('/api/security/decrypt-demo')
      .auth(token, { type: 'bearer' })
      .send(empty.body)
      .expect(200);
    expect(decrypted.body).toEqual({ text: '' });
  });

  it.each(['ciphertext', 'iv', 'authTag'] as const)(
    'rejects tampering with %s without returning plaintext',
    async (field) => {
      const bytes = Buffer.from(encrypted[field], 'base64');
      bytes[0] ^= 1;
      const response = await request(app.getHttpServer())
        .post('/api/security/decrypt-demo')
        .auth(token, { type: 'bearer' })
        .send({ ...encrypted, [field]: bytes.toString('base64') })
        .expect(400);
      expect(response.body).not.toHaveProperty('text');
    },
  );

  it('validates request types, sizes and unknown fields', async () => {
    for (const payload of [
      { text: 123 },
      { text: 'x'.repeat(4097) },
      { text: 'demo', masterKey: 'ignored' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/security/encrypt-demo')
        .auth(token, { type: 'bearer' })
        .send(payload)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/api/security/decrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ ...encrypted, iv: 'invalid' })
      .expect(400);
  });

  it('reports missing AES configuration without affecting login', async () => {
    settings.AES_MASTER_KEY = undefined;
    try {
      await request(app.getHttpServer())
        .post('/api/security/encrypt-demo')
        .auth(token, { type: 'bearer' })
        .send({ text: 'demo' })
        .expect(503);
      await request(app.getHttpServer())
        .post('/api/security/decrypt-demo')
        .auth(token, { type: 'bearer' })
        .send(encrypted)
        .expect(503);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: registration.email, password })
        .expect(200);
    } finally {
      settings.AES_MASTER_KEY = aesKey;
    }
  });

  it('rechecks account status and required password changes for existing tokens', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', mustChangePassword: true },
    });
    await request(app.getHttpServer())
      .post('/api/security/encrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ text: 'demo' })
      .expect(403);
  });

  it('changes the password using Argon2id and unlocks the demo', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: replacementPassword, newPassword: password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: password, newPassword: password })
      .expect(400);
    const changed = await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: password, newPassword: replacementPassword })
      .expect(200);
    expect(changed.body.user).not.toHaveProperty('passwordHash');
    expect(changed.body.user.mustChangePassword).toBe(false);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(user.passwordHash, replacementPassword)).toBe(
      true,
    );
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: registration.email, password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: registration.email, password: replacementPassword })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/security/encrypt-demo')
      .auth(token, { type: 'bearer' })
      .send({ text: 'demo' })
      .expect(200);
  });

  it('has no business API routes', async () => {
    for (const route of [
      'guests',
      'rooms',
      'reservations',
      'payments',
      'transactions',
      'reports',
      'search',
      'settings',
      'notifications',
      'users',
      'nfc',
      'devices',
      'dashboard',
    ]) {
      await request(app.getHttpServer())
        .get('/api/' + route)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
  });
});
