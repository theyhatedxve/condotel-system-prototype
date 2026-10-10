// Offline-only maintenance operation. Never called by an HTTP controller.
import type { Database } from 'better-sqlite3';
import {
  ContactProtectionService,
  normalizeEmail,
  normalizePhone,
  StoredContacts,
} from './contact-protection.service';
import {
  ReservationNotesService,
  StoredNotes,
} from './reservation-notes.service';

type LegacyUser = StoredContacts & {
  email: string | null;
  phone: string | null;
};
type LegacyNotes = StoredNotes & { specialRequests: string | null };
export type MigrationPhase = 'audit' | 'backfill' | 'verify' | 'finalize';
export class PrivacyMigrationError extends Error {}

// Keyset batches bound plaintext memory; maintenance transactions prevent concurrent changes.
export function eachPrivacyRow<T extends { id: string }>(
  db: Database,
  table: 'User' | 'Reservation',
  visit: (row: T) => void,
) {
  let after: string | null = null;
  for (;;) {
    const rows = (
      after === null
        ? db.prepare(`SELECT * FROM "${table}" ORDER BY id LIMIT 200`).all()
        : db
            .prepare(
              `SELECT * FROM "${table}" WHERE id > ? ORDER BY id LIMIT 200`,
            )
            .all(after)
    ) as T[];
    if (!rows.length) return;
    for (const row of rows) visit(row);
    after = rows[rows.length - 1].id;
  }
}

export function migratePrivacy(
  db: Database,
  contacts: ContactProtectionService,
  notes: ReservationNotesService,
  phase: MigrationPhase,
) {
  if (!['audit', 'backfill', 'verify', 'finalize'].includes(phase))
    throw new Error('Invalid migration phase.');
  // Validate both keys even on an empty database.
  contacts.index('email', 'migration-key-check');
  const result = { users: 0, reservations: 0, phase };
  const update = (
    table: string,
    id: string,
    data: Record<string, string | null>,
  ) => {
    const fields = Object.keys(data);
    db.prepare(
      `UPDATE "${table}" SET ${fields.map((field) => `"${field}" = ?`).join(',')} WHERE id = ?`,
    ).run(...Object.values(data), id);
  };

  db.transaction(() => {
    const identities = new Map<string, string>();
    eachPrivacyRow<LegacyUser>(db, 'User', (row) => {
      const email =
        row.email !== null
          ? normalizeEmail(row.email)
          : contacts.verify(row).email;
      if (!email)
        throw new PrivacyMigrationError(`Missing email for user ${row.id}.`);
      const index = contacts.index('email', email);
      const previous = identities.get(index);
      if (previous !== undefined)
        throw new PrivacyMigrationError(
          `Email normalization collision between user IDs ${previous} and ${row.id}. Resolve ownership before continuing.`,
        );
      identities.set(index, row.id);
      result.users++;
    });
    if (phase === 'audit') {
      eachPrivacyRow<LegacyNotes>(db, 'Reservation', () => {
        result.reservations++;
      });
      return;
    }

    eachPrivacyRow<LegacyUser>(db, 'User', (row) => {
      const data: Record<string, string | null> = {};
      for (const field of ['email', 'phone'] as const) {
        const envelope = [
          row[`${field}Ciphertext`],
          row[`${field}Iv`],
          row[`${field}AuthTag`],
          row[`${field}BlindIndex`],
        ];
        const absent = envelope.every((v) => v === null);
        if (!absent && envelope.some((v) => v === null))
          throw new PrivacyMigrationError(
            `Incomplete encrypted contact for user ${row.id}.`,
          );
        if (phase === 'backfill' && absent && row[field] !== null) {
          Object.assign(data, contacts.write(row.id, { [field]: row[field] }));
        }
      }
      if (Object.keys(data).length) update('User', row.id, data);
      const stored = db
        .prepare('SELECT * FROM "User" WHERE id = ?')
        .get(row.id) as LegacyUser;
      const decrypted = contacts.verify(stored);
      if (
        (row.email !== null && decrypted.email !== normalizeEmail(row.email)) ||
        (row.phone !== null &&
          decrypted.phone !== (normalizePhone(row.phone) || null))
      ) {
        throw new PrivacyMigrationError(
          `Encrypted contact verification failed for user ${row.id}.`,
        );
      }
    });

    eachPrivacyRow<LegacyNotes>(db, 'Reservation', (row) => {
      result.reservations++;
      const envelope = [
        row.specialRequestsCiphertext,
        row.specialRequestsIv,
        row.specialRequestsAuthTag,
      ];
      if (
        phase === 'backfill' &&
        envelope.every((v) => v === null) &&
        row.specialRequests !== null
      ) {
        update('Reservation', row.id, notes.write(row.id, row.specialRequests));
      }
      const stored = db
        .prepare('SELECT * FROM "Reservation" WHERE id = ?')
        .get(row.id) as LegacyNotes;
      const decrypted = notes.verify(stored);
      if (row.specialRequests !== null && decrypted !== row.specialRequests) {
        throw new PrivacyMigrationError(
          `Encrypted notes verification failed for reservation ${row.id}.`,
        );
      }
    });

    if (phase === 'finalize') {
      // All rows authenticated and compared inside this write lock before any plaintext is cleared.
      db.exec(`
        UPDATE "User" SET email = NULL, phone = NULL;
        UPDATE "Reservation" SET specialRequests = NULL;
        DROP INDEX IF EXISTS "User_emailBlindIndex_staging_idx";
        CREATE UNIQUE INDEX IF NOT EXISTS "User_emailBlindIndex_key" ON "User"("emailBlindIndex");
      `);
      for (const operation of ['INSERT', 'UPDATE']) {
        db.exec(`CREATE TRIGGER IF NOT EXISTS "User_encrypted_${operation}" BEFORE ${operation} ON "User"
          WHEN NEW.email IS NOT NULL OR NEW.phone IS NOT NULL
            OR NEW.emailCiphertext IS NULL OR NEW.emailIv IS NULL OR NEW.emailAuthTag IS NULL OR NEW.emailBlindIndex IS NULL
            OR ((NEW.phoneCiphertext IS NULL) + (NEW.phoneIv IS NULL) + (NEW.phoneAuthTag IS NULL) + (NEW.phoneBlindIndex IS NULL)) NOT IN (0,4)
          BEGIN SELECT RAISE(ABORT, 'Encrypted contact fields are required; plaintext contact writes are disabled.'); END;`);
        db.exec(`CREATE TRIGGER IF NOT EXISTS "Reservation_encrypted_${operation}" BEFORE ${operation} ON "Reservation"
          WHEN NEW.specialRequests IS NOT NULL
            OR ((NEW.specialRequestsCiphertext IS NULL) + (NEW.specialRequestsIv IS NULL) + (NEW.specialRequestsAuthTag IS NULL)) NOT IN (0,3)
          BEGIN SELECT RAISE(ABORT, 'Encrypted reservation notes are required; plaintext writes are disabled.'); END;`);
      }
    }
  }).immediate();
  return result;
}
