import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import {
  ContactProtectionService,
  StoredContacts,
} from './contact-protection.service';
import {
  ReservationNotesService,
  StoredNotes,
} from './reservation-notes.service';
import { migratePrivacy } from './privacy-migration';
import { rotatePrivacy } from './privacy-rotation';

describe('Staged privacy migration on disposable SQLite', () => {
  let db: Database.Database;
  let contacts: ContactProtectionService;
  let notes: ReservationNotesService;
  let encryption: EncryptionService;
  const legacyNotes = 'Quiet floor\nEstimated arrival: 23:15';
  beforeEach(() => {
    db = new Database(':memory:');
    const migrations = join(process.cwd(), 'prisma', 'migrations');
    for (const dir of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort()) {
      if (dir.startsWith('20261009')) {
        db.prepare(
          `INSERT INTO User (id,email,phone,firstName,lastName,passwordHash,role,status,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`,
        ).run(
          'u1',
          ' ONE@EXAMPLE.TEST ',
          ' +63 900 ',
          'One',
          'User',
          'unchanged-hash',
          'CUSTOMER',
          'ACTIVE',
          Date.now(),
        );
      }
      db.exec(readFileSync(join(migrations, dir, 'migration.sql'), 'utf8'));
    }
    db.prepare(
      'INSERT INTO Room (id,roomNumber,roomType,ratePerNightCentavos,updatedAt) VALUES (?,?,?,?,?)',
    ).run('room', '101', 'Suite', 10000, Date.now());
    db.prepare(
      'INSERT INTO Reservation (id,referenceNo,guestId,roomId,checkIn,checkOut,totalAmountCentavos,specialRequests,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
    ).run(
      'r1',
      'REF1',
      'u1',
      'room',
      Date.now(),
      Date.now() + 86400000,
      10000,
      legacyNotes,
      Date.now(),
    );
    encryption = new EncryptionService(
      new ConfigService({
        AES_MASTER_KEY: randomBytes(32).toString('base64'),
        CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
      }),
    );
    contacts = new ContactProtectionService(encryption);
    notes = new ReservationNotesService(encryption);
  });
  afterEach(() => db.close());
  const user = () =>
    db
      .prepare('SELECT * FROM User WHERE id = ?')
      .get('u1') as StoredContacts & {
      email: string | null;
      phone: string | null;
      passwordHash: string;
    };
  const booking = () =>
    db
      .prepare('SELECT * FROM Reservation WHERE id = ?')
      .get('r1') as StoredNotes & { specialRequests: string | null };
  it('audits, backfills repeatably, verifies, then clears plaintext and enforces encrypted-only writes', () => {
    expect(migratePrivacy(db, contacts, notes, 'audit')).toMatchObject({
      users: 1,
      reservations: 1,
    });
    expect(user().emailCiphertext).toBeNull();
    migratePrivacy(db, contacts, notes, 'backfill');
    const ciphertext = user().emailCiphertext;
    expect(user().email).toBe(' ONE@EXAMPLE.TEST ');
    expect(booking().specialRequests).toBe(legacyNotes);
    migratePrivacy(db, contacts, notes, 'backfill');
    expect(user().emailCiphertext).toBe(ciphertext);
    migratePrivacy(db, contacts, notes, 'verify');
    migratePrivacy(db, contacts, notes, 'finalize');
    migratePrivacy(db, contacts, notes, 'finalize');
    expect(user().email).toBeNull();
    expect(user().phone).toBeNull();
    expect(booking().specialRequests).toBeNull();
    expect(contacts.verify(user())).toEqual({
      email: 'one@example.test',
      phone: '+63 900',
    });
    expect(notes.verify(booking())).toBe(legacyNotes);
    expect(user().passwordHash).toBe('unchanged-hash');
    expect(() =>
      db.prepare('UPDATE User SET email = ?').run('plaintext@example.test'),
    ).toThrow('plaintext');
    expect(() =>
      db.prepare('UPDATE Reservation SET specialRequests = ?').run('plaintext'),
    ).toThrow('plaintext');
    expect(() => db.prepare('UPDATE User SET emailIv = NULL').run()).toThrow();
  });
  it('detects normalization collisions before backfill or uniqueness enforcement', () => {
    db.prepare(
      'INSERT INTO User (id,email,firstName,lastName,passwordHash,updatedAt) VALUES (?,?,?,?,?,?)',
    ).run('u2', 'one@example.test', 'Two', 'User', 'hash', Date.now());
    expect(() => migratePrivacy(db, contacts, notes, 'backfill')).toThrow(
      'collision between user IDs u1 and u2',
    );
    expect(user().emailCiphertext).toBeNull();
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='User_emailBlindIndex_key'",
        )
        .get(),
    ).toBeUndefined();
  });
  it('refuses finalization before backfill', () => {
    expect(() => migratePrivacy(db, contacts, notes, 'finalize')).toThrow();
    expect(user().email).not.toBeNull();
  });
  it('detects collisions involving an empty legacy ID', () => {
    db.prepare(
      'INSERT INTO User (id,email,firstName,lastName,passwordHash,updatedAt) VALUES (?,?,?,?,?,?)',
    ).run('', 'one@example.test', 'Legacy', 'Account', 'hash', Date.now());
    expect(() => migratePrivacy(db, contacts, notes, 'audit')).toThrow(
      'normalization collision',
    );
  });
  it('verifies all rows across keyset batch boundaries', () => {
    const insert = db.prepare(
      'INSERT INTO User (id,email,firstName,lastName,passwordHash,updatedAt) VALUES (?,?,?,?,?,?)',
    );
    for (let index = 0; index < 205; index++)
      insert.run(
        'batch-' + index.toString().padStart(3, '0'),
        `batch-${index}@example.test`,
        'Batch',
        'Account',
        'hash',
        Date.now(),
      );
    expect(migratePrivacy(db, contacts, notes, 'backfill').users).toBe(206);
    expect(migratePrivacy(db, contacts, notes, 'finalize').users).toBe(206);
    expect(
      db
        .prepare(
          'SELECT count(*) AS count FROM User WHERE email IS NOT NULL OR emailCiphertext IS NULL',
        )
        .get(),
    ).toEqual({ count: 0 });
  });
  it('does not skip legacy records with an empty ID during verification and clearing', () => {
    db.prepare(
      'INSERT INTO User (id,email,firstName,lastName,passwordHash,updatedAt) VALUES (?,?,?,?,?,?)',
    ).run('', 'empty-id@example.test', 'Legacy', 'Account', 'hash', Date.now());
    migratePrivacy(db, contacts, notes, 'backfill');
    const stored = db
      .prepare('SELECT * FROM User WHERE id=?')
      .get('') as StoredContacts;
    expect(contacts.verify(stored).email).toBe('empty-id@example.test');
    migratePrivacy(db, contacts, notes, 'finalize');
    expect(
      (
        db.prepare('SELECT email FROM User WHERE id=?').get('') as {
          email: null;
        }
      ).email,
    ).toBeNull();
  });
  it('never clears plaintext after authentication failure or source divergence', () => {
    migratePrivacy(db, contacts, notes, 'backfill');
    db.prepare('UPDATE Reservation SET specialRequestsAuthTag = ?').run(
      randomBytes(16).toString('base64'),
    );
    expect(() => migratePrivacy(db, contacts, notes, 'finalize')).toThrow();
    expect(user().email).not.toBeNull();
    expect(booking().specialRequests).toBe(legacyNotes);
  });
  it('rejects changed search keys without mutating data', () => {
    migratePrivacy(db, contacts, notes, 'backfill');
    const wrong = new ContactProtectionService(
      new EncryptionService(
        new ConfigService({
          AES_MASTER_KEY: randomBytes(32).toString('base64'),
          CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
        }),
      ),
    );
    expect(() => migratePrivacy(db, wrong, notes, 'finalize')).toThrow();
    expect(user().email).not.toBeNull();
  });
  it.each(['email', 'phone', 'specialRequests'])(
    'refuses to clear changed legacy %s after backfill',
    (field) => {
      migratePrivacy(db, contacts, notes, 'backfill');
      const before = user();
      const originalNotes = booking();
      if (field === 'specialRequests') {
        db.prepare('UPDATE Reservation SET specialRequests=? WHERE id=?').run(
          'Changed after backfill',
          'r1',
        );
      } else {
        db.prepare(`UPDATE User SET ${field}=? WHERE id=?`).run(
          field === 'email' ? 'changed@example.test' : '+63 123',
          'u1',
        );
      }
      expect(() => migratePrivacy(db, contacts, notes, 'finalize')).toThrow(
        'verification failed',
      );
      expect(user().email).not.toBeNull();
      expect(user().phone).not.toBeNull();
      expect(booking().specialRequests).not.toBeNull();
      expect(user().emailCiphertext).toBe(before.emailCiphertext);
      expect(user().phoneCiphertext).toBe(before.phoneCiphertext);
      expect(booking().specialRequestsCiphertext).toBe(
        originalNotes.specialRequestsCiphertext,
      );
    },
  );
  it('allows duplicate phones and enforces normalized email uniqueness after finalization', () => {
    migratePrivacy(db, contacts, notes, 'backfill');
    migratePrivacy(db, contacts, notes, 'finalize');
    const data = contacts.write('u2', {
      email: 'two@example.test',
      phone: '+63 900',
    });
    const fields = Object.keys(data);
    db.prepare(
      `INSERT INTO User (id,firstName,lastName,passwordHash,updatedAt,${fields.join(',')}) VALUES (?,?,?,?,?,${fields.map(() => '?').join(',')})`,
    ).run('u2', 'Two', 'User', 'hash', Date.now(), ...Object.values(data));
    expect(
      db
        .prepare('SELECT count(*) AS count FROM User WHERE phoneBlindIndex=?')
        .get(user().phoneBlindIndex),
    ).toEqual({ count: 2 });
    expect(() =>
      db
        .prepare('UPDATE User SET emailBlindIndex=? WHERE id=?')
        .run(user().emailBlindIndex, 'u2'),
    ).toThrow('UNIQUE');
  });
  it('atomically rotates encryption and search keys, including archived device secrets', () => {
    migratePrivacy(db, contacts, notes, 'backfill');
    migratePrivacy(db, contacts, notes, 'finalize');
    const old = user();
    const secret = encryption.encrypt('archived device secret');
    db.prepare(
      'INSERT INTO Device (deviceId,deviceName,deviceKeyCiphertext,deviceKeyIv,deviceKeyAuthTag) VALUES (?,?,?,?,?)',
    ).run('device', 'Archived', secret.ciphertext, secret.iv, secret.authTag);
    const next = new EncryptionService(
      new ConfigService({
        AES_MASTER_KEY: randomBytes(32).toString('base64'),
        CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
      }),
    );
    rotatePrivacy(db, encryption, next);
    expect(user().emailBlindIndex).not.toBe(old.emailBlindIndex);
    expect(user().emailCiphertext).not.toBe(old.emailCiphertext);
    expect(() => contacts.verify(user())).toThrow();
    expect(new ContactProtectionService(next).verify(user()).email).toBe(
      'one@example.test',
    );
    expect(new ReservationNotesService(next).verify(booking())).toBe(
      legacyNotes,
    );
    const stored = db
      .prepare(
        'SELECT deviceKeyCiphertext AS ciphertext, deviceKeyIv AS iv, deviceKeyAuthTag AS authTag FROM Device',
      )
      .get() as { ciphertext: string; iv: string; authTag: string };
    expect(next.decrypt(stored)).toBe('archived device secret');
  });
  it('rolls back all rotated rows if an archived value fails authentication', () => {
    migratePrivacy(db, contacts, notes, 'backfill');
    migratePrivacy(db, contacts, notes, 'finalize');
    const before = user();
    db.prepare(
      'INSERT INTO Device (deviceId,deviceName,deviceKeyCiphertext,deviceKeyIv,deviceKeyAuthTag) VALUES (?,?,?,?,?)',
    ).run('broken', 'Broken', 'bad', 'bad', 'bad');
    const next = new EncryptionService(
      new ConfigService({
        AES_MASTER_KEY: randomBytes(32).toString('base64'),
        CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
      }),
    );
    expect(() => rotatePrivacy(db, encryption, next)).toThrow();
    expect(user()).toEqual(before);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='User_emailBlindIndex_key'",
        )
        .get(),
    ).toBeDefined();
  });
});
