import type { Database } from 'better-sqlite3';
import { EncryptionService } from './encryption.service';
import {
  ContactProtectionService,
  StoredContacts,
} from './contact-protection.service';
import {
  ReservationNotesService,
  StoredNotes,
} from './reservation-notes.service';
import { eachPrivacyRow, migratePrivacy } from './privacy-migration';

export function rotatePrivacy(
  db: Database,
  current: EncryptionService,
  next: EncryptionService,
) {
  const oldContacts = new ContactProtectionService(current),
    newContacts = new ContactProtectionService(next);
  const oldNotes = new ReservationNotesService(current),
    newNotes = new ReservationNotesService(next);
  newContacts.index('email', 'rotation-key-check');
  db.transaction(() => {
    migratePrivacy(db, oldContacts, oldNotes, 'verify');
    const plaintext = db
      .prepare(
        'SELECT count(*) AS count FROM User WHERE email IS NOT NULL OR phone IS NOT NULL',
      )
      .get() as { count: number };
    const legacyNotes = db
      .prepare(
        'SELECT count(*) AS count FROM Reservation WHERE specialRequests IS NOT NULL',
      )
      .get() as { count: number };
    if (plaintext.count || legacyNotes.count)
      throw new Error('Finalize migration before key rotation.');
    // Indexes change as one offline transaction; no mixed-key lookup window is exposed.
    db.exec('DROP INDEX IF EXISTS "User_emailBlindIndex_key"');
    eachPrivacyRow<StoredContacts>(db, 'User', (row) => {
      const original = oldContacts.verify(row);
      const data = newContacts.write(row.id, original);
      const fields = Object.keys(data);
      db.prepare(
        `UPDATE User SET ${fields.map((field) => `"${field}"=?`).join(',')} WHERE id=?`,
      ).run(...Object.values(data), row.id);
      const stored = db
        .prepare('SELECT * FROM User WHERE id=?')
        .get(row.id) as StoredContacts;
      const checked = newContacts.verify(stored);
      if (checked.email !== original.email || checked.phone !== original.phone)
        throw new Error('Contact rotation verification failed.');
    });
    eachPrivacyRow<StoredNotes>(db, 'Reservation', (row) => {
      const original = oldNotes.verify(row);
      const data = newNotes.write(row.id, original);
      db.prepare(
        'UPDATE Reservation SET specialRequestsCiphertext=?, specialRequestsIv=?, specialRequestsAuthTag=? WHERE id=?',
      ).run(
        data.specialRequestsCiphertext,
        data.specialRequestsIv,
        data.specialRequestsAuthTag,
        row.id,
      );
      if (
        newNotes.verify(
          db
            .prepare('SELECT * FROM Reservation WHERE id=?')
            .get(row.id) as StoredNotes,
        ) !== original
      )
        throw new Error('Note rotation verification failed.');
    });
    // Removed Device Management records remain recoverable under the same master key.
    const devices = db
      .prepare(
        'SELECT deviceId, deviceKeyCiphertext, deviceKeyIv, deviceKeyAuthTag FROM Device',
      )
      .all() as Array<{
      deviceId: string;
      deviceKeyCiphertext: string;
      deviceKeyIv: string;
      deviceKeyAuthTag: string;
    }>;
    for (const device of devices) {
      const original = current.decrypt({
        ciphertext: device.deviceKeyCiphertext,
        iv: device.deviceKeyIv,
        authTag: device.deviceKeyAuthTag,
      });
      const encrypted = next.encrypt(original);
      db.prepare(
        'UPDATE Device SET deviceKeyCiphertext=?, deviceKeyIv=?, deviceKeyAuthTag=? WHERE deviceId=?',
      ).run(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        device.deviceId,
      );
      const stored = db
        .prepare(
          'SELECT deviceKeyCiphertext AS ciphertext, deviceKeyIv AS iv, deviceKeyAuthTag AS authTag FROM Device WHERE deviceId=?',
        )
        .get(device.deviceId) as {
        ciphertext: string;
        iv: string;
        authTag: string;
      };
      if (next.decrypt(stored) !== original)
        throw new Error('Archived device rotation verification failed.');
    }
    db.exec(
      'CREATE UNIQUE INDEX "User_emailBlindIndex_key" ON "User"("emailBlindIndex")',
    );
    migratePrivacy(db, newContacts, newNotes, 'verify');
  }).immediate();
}
