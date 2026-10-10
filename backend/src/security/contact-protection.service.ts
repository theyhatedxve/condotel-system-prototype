import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { Actor, requireOwnerOrStaff } from './access';

export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();
// Preserve current identity rules: do not remove punctuation or infer country codes.
export const normalizePhone = (value: string): string => value.trim();

export interface StoredContacts {
  id: string;
  emailCiphertext: string | null;
  emailIv: string | null;
  emailAuthTag: string | null;
  emailBlindIndex: string | null;
  phoneCiphertext: string | null;
  phoneIv: string | null;
  phoneAuthTag: string | null;
  phoneBlindIndex: string | null;
}

@Injectable()
export class ContactProtectionService {
  constructor(private readonly encryption: EncryptionService) {}

  index(field: 'email' | 'phone', value: string): string {
    return this.protect(() =>
      this.encryption.blindIndex(
        field,
        field === 'email' ? normalizeEmail(value) : normalizePhone(value),
      ),
    );
  }

  // Shared by registration, contact updates and the offline migration. No plaintext writes.
  write(id: string, contacts: { email?: string; phone?: string | null }) {
    return this.protect(() => {
      const data: Partial<Omit<StoredContacts, 'id'>> = {};
      for (const field of ['email', 'phone'] as const) {
        const value = contacts[field];
        if (value === undefined) continue;
        const normalized =
          value === null
            ? null
            : field === 'email'
              ? normalizeEmail(value)
              : normalizePhone(value);
        if (field === 'email' && !normalized)
          throw new Error('Email is required.');
        // Empty optional phone is absent, matching RegisterDto.
        const encrypted = normalized
          ? this.encryption.encrypt(normalized, this.context(id, field))
          : null;
        data[`${field}Ciphertext`] = encrypted?.ciphertext ?? null;
        data[`${field}Iv`] = encrypted?.iv ?? null;
        data[`${field}AuthTag`] = encrypted?.authTag ?? null;
        data[`${field}BlindIndex`] = normalized
          ? this.index(field, normalized)
          : null;
      }
      return data;
    });
  }

  // Authentication has already verified the account (or just created it).
  // Never accept the authenticated ID from a request body.
  readOwn(row: StoredContacts, authenticatedId: string) {
    if (row.id !== authenticatedId)
      throw new ForbiddenException('Contact access denied.');
    return this.verify(row);
  }

  readAuthorized(row: StoredContacts, actor: Actor) {
    requireOwnerOrStaff(actor, row.id);
    return this.verify(row);
  }

  // Internal verification for trusted offline migration; not exposed as an API.
  verify(row: StoredContacts): { email: string; phone: string | null } {
    return this.protect(() => {
      const read = (field: 'email' | 'phone'): string | null => {
        const ciphertext = row[`${field}Ciphertext`];
        const iv = row[`${field}Iv`];
        const authTag = row[`${field}AuthTag`];
        const index = row[`${field}BlindIndex`];
        if (
          field === 'phone' &&
          [ciphertext, iv, authTag, index].every((v) => v === null)
        )
          return null;
        if (ciphertext === null || !iv || !authTag || !index)
          throw new Error('Incomplete encrypted contact.');
        const value = this.encryption.decrypt(
          { ciphertext, iv, authTag },
          this.context(row.id, field),
        );
        if (this.index(field, value) !== index)
          throw new Error('Contact index mismatch.');
        return value;
      };
      const email = read('email');
      if (!email) throw new Error('Encrypted email is missing.');
      return { email, phone: read('phone') };
    });
  }

  private context(id: string, field: string): string {
    return JSON.stringify(['condotel', 'contact', 1, id, field]);
  }

  private protect<T>(operation: () => T): T {
    try {
      return operation();
    } catch {
      // No values, key material, SQL parameters or cryptographic internals in responses/logs.
      throw new ServiceUnavailableException(
        'Encrypted contact data is unavailable; check keys and migration integrity.',
      );
    }
  }
}
