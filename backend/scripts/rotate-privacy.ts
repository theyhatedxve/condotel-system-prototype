import 'reflect-metadata';
import 'dotenv/config';
import Database from 'better-sqlite3';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/security/encryption.service';
import { rotatePrivacy } from '../src/security/privacy-rotation';

const [databasePath, confirmation] = process.argv.slice(2);
let db: Database.Database | undefined;
try {
  if (
    !databasePath ||
    confirmation !== '--offline-backup-confirmed' ||
    !process.env.NEXT_AES_MASTER_KEY ||
    !process.env.NEXT_CONTACT_SEARCH_KEY
  )
    throw new Error();
  db = new Database(databasePath, { fileMustExist: true });
  db.pragma('secure_delete = ON');
  const current = new EncryptionService(new ConfigService());
  const next = new EncryptionService(
    new ConfigService({
      AES_MASTER_KEY: process.env.NEXT_AES_MASTER_KEY,
      CONTACT_SEARCH_KEY: process.env.NEXT_CONTACT_SEARCH_KEY,
    }),
  );
  rotatePrivacy(db, current, next);
  process.stdout.write(
    'Rotation verified and committed. Activate the NEXT keys in backend configuration before restarting. Preserve the old keys with older backups.\n',
  );
} catch {
  process.stderr.write(
    'Rotation failed; the transaction was rolled back. Keep the current keys and inspect the recovery runbook.\n',
  );
  process.exitCode = 1;
} finally {
  db?.close();
}
