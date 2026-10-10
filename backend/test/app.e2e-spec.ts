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
import Database from 'better-sqlite3';
import { ContactProtectionService } from '../src/security/contact-protection.service';
import { ReservationNotesService } from '../src/security/reservation-notes.service';
import { migratePrivacy } from '../src/security/privacy-migration';
import { createHmac } from 'node:crypto';
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
    CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
    PAYMONGO_SECRET_KEY: 'sk_test_' + randomBytes(24).toString('hex'),
    PAYMONGO_WEBHOOK_SECRET: randomBytes(32).toString('base64'),
    FRONTEND_URL: 'http://localhost:5173',
  };
  const registration = {
    email: 'demo@example.test',
    username: 'demo',
    firstName: 'Demo',
    lastName: 'User',
    password,
    phone: '+63 900 123',
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
    const db = new Database(join(testDirectory, 'test.db'));
    const encryption = new EncryptionService(new ConfigService(settings));
    migratePrivacy(
      db,
      new ContactProtectionService(encryption),
      new ReservationNotesService(encryption),
      'finalize',
    );
    db.close();
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
    app = module.createNestApplication({ rawBody: true });
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
    expect(user.legacyEmail).toBeNull();
    expect(user.legacyPhone).toBeNull();
    expect(JSON.stringify(user)).not.toContain(registration.email);
    expect(JSON.stringify(user)).not.toContain(registration.phone);
    expect(response.body.user.email).toBe(registration.email);
    expect(response.body.user.phone).toBe(registration.phone);
    for (const key of Object.keys(response.body.user))
      expect(key).not.toMatch(/Ciphertext|Iv|AuthTag|BlindIndex|legacy/);
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
  it('does not expose removed devices or unrelated placeholder APIs', async () => {
    for (const route of [
      'transactions',
      'reports',
      'search',
      'settings',

      'nfc',
      'devices',
    ]) {
      await request(app.getHttpServer())
        .get('/api/' + route)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
  });

  it('rejects normalized duplicate email and permits duplicate phones', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        ...registration,
        username: 'different',
        email: ' DEMO@EXAMPLE.TEST ',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        ...registration,
        username: 'second',
        email: 'second@example.test',
      })
      .expect(201);
  });

  it('updates contacts atomically, changes email login, clears phone and rejects mass assignment', async () => {
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .send({ email: 'new@example.test' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(400);
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ email: 'second@example.test', phone: 'changed' })
      .expect(409);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .phoneCiphertext,
    ).toBe(before.phoneCiphertext);
    const changed = await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ email: ' NEW@EXAMPLE.TEST ', phone: null })
      .expect(200);
    expect(changed.body.user.email).toBe('new@example.test');
    expect(changed.body.user.phone).toBeNull();
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: registration.email, password: replacementPassword })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: 'NEW@EXAMPLE.TEST', password: replacementPassword })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ phone: ' +63 999 ' })
      .expect(200);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(stored.legacyEmail).toBeNull();
    expect(stored.legacyPhone).toBeNull();
    expect(app.get(ContactProtectionService).verify(stored)).toEqual({
      email: 'new@example.test',
      phone: '+63 999',
    });
  });

  let adminToken: string;
  let secondToken: string;
  let reservationId: string;
  let roomId: string;
  const specialRequests = 'Quiet room please\n日本語';
  it('restricts management and performs indexed exact contacts with partial name search', async () => {
    await request(app.getHttpServer())
      .get('/api/guests')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .expect(403);
    const admin = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...registration, username: 'admin', email: 'admin@example.test' })
      .expect(201);
    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' },
    });
    adminToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin', password })
        .expect(200)
    ).body.accessToken;
    secondToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'second', password })
        .expect(200)
    ).body.accessToken;
    for (const search of ['NEW@EXAMPLE.TEST', '+63 999']) {
      const found = await request(app.getHttpServer())
        .get('/api/guests')
        .query({ search })
        .auth(adminToken, { type: 'bearer' })
        .expect(200);
      expect(found.body.map((u: { id: string }) => u.id)).toEqual([userId]);
    }
    const partial = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: 'example.test' })
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(partial.body).toEqual([]);
    const names = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: 'Dem' })
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(names.body.length).toBeGreaterThan(0);
    const count = await prisma.user.count();
    await request(app.getHttpServer())
      .post('/api/users/import')
      .auth(adminToken, { type: 'bearer' })
      .send({
        users: [
          {
            ...registration,
            username: 'imported',
            email: 'imported@example.test',
          },
          { ...registration, username: 'duplicate', email: 'new@example.test' },
        ],
      })
      .expect(409);
    expect(await prisma.user.count()).toBe(count);
    await request(app.getHttpServer())
      .post('/api/users/import')
      .auth(adminToken, { type: 'bearer' })
      .send({
        users: [
          {
            ...registration,
            username: 'imported',
            email: 'imported@example.test',
          },
        ],
      })
      .expect(201);
    const imported = await prisma.user.findUniqueOrThrow({
      where: { username: 'imported' },
    });
    expect(imported.legacyEmail).toBeNull();
    expect(imported.emailCiphertext).toBeTruthy();
    expect(imported.mustChangePassword).toBe(true);
    await request(app.getHttpServer())
      .patch('/api/guests/' + userId)
      .auth(adminToken, { type: 'bearer' })
      .send({ phone: '+63 999' })
      .expect(200);
  });

  it('limits staff to guest management and encrypts guest contact replacements', async () => {
    const staff = await request(app.getHttpServer())
      .post('/api/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        ...registration,
        username: 'staff',
        email: 'staff@example.test',
        role: 'STAFF',
      })
      .expect(201);
    await prisma.user.update({
      where: { id: staff.body.id },
      data: { mustChangePassword: false },
    });
    const staffToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'staff', password })
        .expect(200)
    ).body.accessToken;
    await request(app.getHttpServer())
      .get('/api/users')
      .auth(staffToken, { type: 'bearer' })
      .expect(403);
    const guest = await request(app.getHttpServer())
      .post('/api/guests')
      .auth(staffToken, { type: 'bearer' })
      .send({
        ...registration,
        username: 'walkin',
        email: 'walkin@example.test',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/api/guests/' + guest.body.id)
      .auth(staffToken, { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/guests/' + staff.body.id)
      .auth(staffToken, { type: 'bearer' })
      .send({ email: 'attack@example.test' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/guests/' + guest.body.id)
      .auth(staffToken, { type: 'bearer' })
      .send({ email: ' WALKIN.NEW@EXAMPLE.TEST ', phone: ' 555-0101 ' })
      .expect(200);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: guest.body.id },
    });
    expect(stored.legacyEmail).toBeNull();
    expect(stored.legacyPhone).toBeNull();
    expect(app.get(ContactProtectionService).verify(stored)).toEqual({
      email: 'walkin.new@example.test',
      phone: '555-0101',
    });
    for (const search of ['walkin.new@example.test', '555-0101']) {
      const found = await request(app.getHttpServer())
        .get('/api/guests')
        .query({ search })
        .auth(staffToken, { type: 'bearer' })
        .expect(200);
      expect(found.body.map((row: { id: string }) => row.id)).toEqual([
        guest.body.id,
      ]);
    }
    const old = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: 'walkin@example.test' })
      .auth(staffToken, { type: 'bearer' })
      .expect(200);
    expect(old.body).toEqual([]);
  });

  it('creates encrypted reservations, preserves arrival/optional notes and prevents unauthorized reads and overlapping bookings', async () => {
    const room = await request(app.getHttpServer())
      .post('/api/rooms')
      .auth(adminToken, { type: 'bearer' })
      .send({
        roomNumber: '101',
        roomType: 'Suite',
        capacity: 4,
        ratePerNightCentavos: 250000,
      })
      .expect(201);
    roomId = room.body.id;
    const checkIn = new Date(Date.now() + 86400000 * 10)
      .toISOString()
      .slice(0, 10);
    const checkOut = new Date(Date.now() + 86400000 * 12)
      .toISOString()
      .slice(0, 10);
    const payload = {
      roomId,
      checkIn,
      checkOut,
      adults: 2,
      specialRequests,
      estimatedArrival: '21:30',
    };
    const created = await request(app.getHttpServer())
      .post('/api/reservations')
      .auth(token, { type: 'bearer' })
      .send(payload)
      .expect(201);
    reservationId = created.body.id;
    expect(created.body.specialRequests).toBe(
      specialRequests + '\nEstimated arrival: 21:30',
    );
    expect(created.body.totalAmountCentavos).toBe(500000);
    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(stored.legacySpecialRequests).toBeNull();
    expect(JSON.stringify(stored)).not.toContain('Quiet room');
    expect(created.body).not.toHaveProperty('specialRequestsCiphertext');
    await request(app.getHttpServer())
      .post('/api/reservations')
      .auth(secondToken, { type: 'bearer' })
      .send(payload)
      .expect(409);
    const decrypt = jest.spyOn(app.get(EncryptionService), 'decrypt');
    await request(app.getHttpServer())
      .get('/api/reservations/' + reservationId)
      .auth(secondToken, { type: 'bearer' })
      .expect(403);
    expect(
      decrypt.mock.calls.some((call) => call[1]?.includes(reservationId)),
    ).toBe(false);
    decrypt.mockRestore();
    await request(app.getHttpServer())
      .patch('/api/reservations/' + reservationId)
      .auth(secondToken, { type: 'bearer' })
      .send({ specialRequests: 'attack' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/reservations/' + reservationId)
      .auth(token, { type: 'bearer' })
      .send({ status: 'CHECKED_IN' })
      .expect(403);
    const changed = await request(app.getHttpServer())
      .patch('/api/reservations/' + reservationId)
      .auth(token, { type: 'bearer' })
      .send({ specialRequests: '' })
      .expect(200);
    expect(changed.body.specialRequests).toBe('');
    await request(app.getHttpServer())
      .patch('/api/reservations/' + reservationId)
      .auth(token, { type: 'bearer' })
      .send({ specialRequests: null })
      .expect(200);
    const cleared = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(cleared.specialRequestsCiphertext).toBeNull();
    expect(cleared.specialRequestsIv).toBeNull();
    expect(cleared.specialRequestsAuthTag).toBeNull();
    await request(app.getHttpServer())
      .patch('/api/reservations/' + reservationId)
      .auth(token, { type: 'bearer' })
      .send({ specialRequests })
      .expect(200);
  });

  it('passes only authorized billing contacts to checkout, validates signed payment events and isolates notifications', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_Test123',
            attributes: {
              checkout_url: 'https://checkout.paymongo.com/test',
              livemode: false,
            },
          },
        }),
        { status: 200 },
      ),
    );
    try {
      await request(app.getHttpServer())
        .post('/api/payments/checkout/' + reservationId)
        .auth(secondToken, { type: 'bearer' })
        .expect(403);
      expect(fetchMock).not.toHaveBeenCalled();
      const response = await request(app.getHttpServer())
        .post('/api/payments/checkout/' + reservationId)
        .auth(token, { type: 'bearer' })
        .expect(201);
      const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string).data
        .attributes;
      expect(sent.billing).toEqual({
        name: 'Demo User',
        email: 'new@example.test',
        phone: '+63 999',
      });
      expect(JSON.stringify(sent)).not.toContain(specialRequests);
      expect(sent.reference_number).toBe(response.body.id);
      await request(app.getHttpServer())
        .post('/api/payments/checkout/' + reservationId)
        .auth(token, { type: 'bearer' })
        .expect(201);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await request(app.getHttpServer())
        .patch('/api/reservations/' + reservationId)
        .auth(token, { type: 'bearer' })
        .send({ status: 'CANCELLED' })
        .expect(409);
      const payload = {
        data: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_Test123',
            attributes: {
              reference_number: response.body.id,
              payments: [
                {
                  id: 'pay_Test',
                  attributes: {
                    status: 'paid',
                    amount: 500000,
                    currency: 'PHP',
                  },
                },
              ],
            },
          },
        },
      };
      const body = JSON.stringify(payload);
      const time = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac('sha256', settings.PAYMONGO_WEBHOOK_SECRET!)
        .update(time + '.' + body)
        .digest('hex');
      await request(app.getHttpServer())
        .post('/api/payments/webhook/paymongo')
        .send(payload)
        .expect(401);
      for (let retry = 0; retry < 2; retry++)
        await request(app.getHttpServer())
          .post('/api/payments/webhook/paymongo')
          .set('Paymongo-Signature', `t=${time},te=${signature},li=`)
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(201);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: response.body.id },
          })
        ).status,
      ).toBe('PAID');
      expect(
        (
          await prisma.reservation.findUniqueOrThrow({
            where: { id: reservationId },
          })
        ).status,
      ).toBe('CONFIRMED');
      expect(
        await prisma.notification.count({
          where: { dedupeKey: `payment:${response.body.id}:paid` },
        }),
      ).toBe(1);
      const notifications = await request(app.getHttpServer())
        .get('/api/notifications')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(JSON.stringify(notifications.body)).not.toContain(specialRequests);
      expect(JSON.stringify(notifications.body)).not.toContain(
        'new@example.test',
      );
      await request(app.getHttpServer())
        .patch('/api/notifications/' + notifications.body[0].id + '/read')
        .auth(secondToken, { type: 'bearer' })
        .expect(404);
      await request(app.getHttpServer())
        .patch('/api/notifications/' + notifications.body[0].id + '/read')
        .auth(token, { type: 'bearer' })
        .expect(200);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('fails clearly on tampered notes and never decrypts contacts before successful login verification', async () => {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { specialRequestsAuthTag: randomBytes(16).toString('base64') },
    });
    const failure = await request(app.getHttpServer())
      .get('/api/reservations/' + reservationId)
      .auth(token, { type: 'bearer' })
      .expect(503);
    expect(failure.body.message).toContain('authenticated or decrypted');
    const original = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { emailAuthTag: randomBytes(16).toString('base64') },
    });
    const decrypt = jest.spyOn(app.get(EncryptionService), 'decrypt');
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: 'new@example.test', password: 'incorrect' })
      .expect(401);
    expect(decrypt).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: 'new@example.test', password: replacementPassword })
      .expect(503);
    decrypt.mockRestore();
    await prisma.user.update({
      where: { id: userId },
      data: { emailAuthTag: original.emailAuthTag },
    });
  });
});
