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
import { EncryptionService } from '../src/security/encryption.service';
import { PrismaService } from '../src/prisma/prisma.service';
describe('Authentication (real SQLite, Argon2id, JWT)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testDirectory: string;
  let token: string;
  let userId: string;
  const password = randomBytes(24).toString('base64');
  const replacementPassword = randomBytes(24).toString('base64');
  const jwtSecret = randomBytes(32).toString('base64');
  const settings: Record<string, string | undefined> = {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN_SECONDS: '3600',
    AES_MASTER_KEY: randomBytes(32).toString('base64'),
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
      new JwtService({ secret: jwtSecret }).verify<{
        sub: string;
      }>(token).sub,
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
    for (const endpoint of ['/api/auth/me']) {
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
  it('rechecks account status for existing tokens', async () => {
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
      data: { status: 'ACTIVE' },
    });
  });
  it('changes the password using Argon2id and clears the password-change requirement', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
    const current = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(current.body.user.mustChangePassword).toBe(true);
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
      'dashboard',
    ]) {
      await request(app.getHttpServer())
        .get('/api/' + route)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
  });

  it('restricts device registration and listing to authenticated administrators', async () => {
    await request(app.getHttpServer()).get('/api/devices').expect(401);
    await request(app.getHttpServer())
      .post('/api/devices')
      .send({ deviceName: 'Door' })
      .expect(401);
    for (const role of ['CUSTOMER', 'STAFF'] as const) {
      await prisma.user.update({ where: { id: userId }, data: { role } });
      await request(app.getHttpServer())
        .get('/api/devices')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/devices')
        .auth(token, { type: 'bearer' })
        .send({ deviceName: 'Door' })
        .expect(403);
    }
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN', mustChangePassword: true },
    });
    await request(app.getHttpServer())
      .post('/api/devices')
      .auth(token, { type: 'bearer' })
      .send({ deviceName: 'Door' })
      .expect(403);
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    });
    expect(await prisma.device.count()).toBe(0);
  });

  it('persists only encrypted device secrets and returns the provisioning secret once', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/devices')
      .auth(token, { type: 'bearer' })
      .send({ deviceName: '  Room 101 Door  ' })
      .expect(201);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(Buffer.from(first.body.deviceSecret, 'base64')).toHaveLength(32);
    expect(first.body.device.deviceName).toBe('Room 101 Door');
    expect(Object.keys(first.body.device).sort()).toEqual([
      'createdAt',
      'deviceId',
      'deviceName',
    ]);
    const stored = await prisma.device.findUniqueOrThrow({
      where: { deviceId: first.body.device.deviceId },
    });
    expect(JSON.stringify(stored)).not.toContain(first.body.deviceSecret);
    expect(Buffer.from(stored.deviceKeyIv, 'base64')).toHaveLength(12);
    expect(Buffer.from(stored.deviceKeyAuthTag, 'base64')).toHaveLength(16);
    expect(
      app
        .get(EncryptionService)
        .decrypt({
          ciphertext: stored.deviceKeyCiphertext,
          iv: stored.deviceKeyIv,
          authTag: stored.deviceKeyAuthTag,
        }),
    ).toBe(first.body.deviceSecret);
    const second = await request(app.getHttpServer())
      .post('/api/devices')
      .auth(token, { type: 'bearer' })
      .send({ deviceName: 'Room 102 Door' })
      .expect(201);
    expect(second.body.deviceSecret).not.toBe(first.body.deviceSecret);
    const storedSecond = await prisma.device.findUniqueOrThrow({
      where: { deviceId: second.body.device.deviceId },
    });
    expect(storedSecond.deviceKeyIv).not.toBe(stored.deviceKeyIv);
    const list = await request(app.getHttpServer())
      .get('/api/devices')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body).toHaveLength(2);
    for (const device of list.body)
      expect(Object.keys(device).sort()).toEqual([
        'createdAt',
        'deviceId',
        'deviceName',
      ]);
    expect(JSON.stringify(list.body)).not.toContain(first.body.deviceSecret);
  });

  it('rejects invalid or duplicate names and fails safely without a usable master key', async () => {
    for (const payload of [
      { deviceName: '' },
      { deviceName: '   ' },
      { deviceName: 12 },
      { deviceName: 'x'.repeat(101) },
      { deviceName: 'Door', deviceSecret: 'client-key' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/devices')
        .auth(token, { type: 'bearer' })
        .send(payload)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/api/devices')
      .auth(token, { type: 'bearer' })
      .send({ deviceName: 'Room 101 Door' })
      .expect(409);
    const masterKey = settings.AES_MASTER_KEY;
    try {
      for (const invalidKey of [undefined, 'invalid']) {
        settings.AES_MASTER_KEY = invalidKey;
        await request(app.getHttpServer())
          .post('/api/devices')
          .auth(token, { type: 'bearer' })
          .send({ deviceName: 'Unavailable' })
          .expect(503);
      }
    } finally {
      settings.AES_MASTER_KEY = masterKey;
    }
    expect(await prisma.device.count()).toBe(2);
  });
});
