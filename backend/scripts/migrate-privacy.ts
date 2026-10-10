import 'reflect-metadata';
import 'dotenv/config';
import Database from 'better-sqlite3';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/security/encryption.service';
import { ContactProtectionService } from '../src/security/contact-protection.service';
import { ReservationNotesService } from '../src/security/reservation-notes.service';
import {
  migratePrivacy,
  MigrationPhase,
  PrivacyMigrationError,
} from '../src/security/privacy-migration';

// Explicit path prevents accidentally selecting DATABASE_URL or creating a new database.
const [phase, databasePath, confirmation] = process.argv.slice(2);
if (
  !databasePath ||
  !['audit', 'backfill', 'verify', 'finalize'].includes(phase) ||
  (['backfill', 'finalize'].includes(phase) &&
    confirmation !== '--offline-backup-confirmed')
) {
  process.stderr.write(
    'Usage: npm run privacy:migrate -- audit|backfill|verify|finalize <existing-db-path> [--offline-backup-confirmed]\n',
  );
  process.exitCode = 1;
} else {
  let db: Database.Database | undefined;
  let finalized = false;
  try {
    db = new Database(databasePath, { fileMustExist: true });
    db.pragma('foreign_keys = ON');
    db.pragma('secure_delete = ON');
    const encryption = new EncryptionService(new ConfigService());
    const result = migratePrivacy(
      db,
      new ContactProtectionService(encryption),
      new ReservationNotesService(encryption),
      phase as MigrationPhase,
    );
    if (phase === 'finalize') {
      finalized = true;
      // Remove legacy free-page/WAL copies as well as clearing logical columns.
      const checkpoint = () => {
        const rows = db!.pragma('wal_checkpoint(TRUNCATE)') as Array<{
          busy: number;
        }>;
        if (rows.some((row) => row.busy !== 0))
          throw new Error('SQLite readers prevent checkpoint.');
      };
      checkpoint();
      db.exec('VACUUM');
      checkpoint();
    }
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    // Database errors can contain SQL/value fragments; never print raw errors.
    process.stderr.write(
      finalized
        ? 'Finalization committed, but database file cleanup did not finish. Keep the app offline, close other SQLite connections, and repeat finalize.\n'
        : error instanceof PrivacyMigrationError
          ? error.message + '\n'
          : 'Privacy migration failed. No changes from this phase were committed. Check keys, normalization collisions, schema and ciphertext using the runbook.\n',
    );
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
