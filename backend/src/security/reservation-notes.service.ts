import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { Actor, requireOwnerOrStaff } from './access';

export interface StoredNotes {
  id: string;
  guestId: string;
  specialRequestsCiphertext: string | null;
  specialRequestsIv: string | null;
  specialRequestsAuthTag: string | null;
}

@Injectable()
export class ReservationNotesService {
  constructor(private readonly encryption: EncryptionService) {}

  write(id: string, specialRequests: string | null) {
    try {
      const value =
        specialRequests === null
          ? null
          : this.encryption.encrypt(specialRequests, this.context(id));
      return {
        specialRequestsCiphertext: value?.ciphertext ?? null,
        specialRequestsIv: value?.iv ?? null,
        specialRequestsAuthTag: value?.authTag ?? null,
      };
    } catch {
      throw this.unavailable();
    }
  }

  read(row: StoredNotes, actor: Actor) {
    requireOwnerOrStaff(actor, row.guestId);
    return this.verify(row);
  }

  verify(row: StoredNotes): string | null {
    const {
      specialRequestsCiphertext: ciphertext,
      specialRequestsIv: iv,
      specialRequestsAuthTag: authTag,
    } = row;
    if ([ciphertext, iv, authTag].every((value) => value === null)) return null;
    if (ciphertext === null || !iv || !authTag) throw this.unavailable();
    try {
      return this.encryption.decrypt(
        { ciphertext, iv, authTag },
        this.context(row.id),
      );
    } catch {
      throw this.unavailable();
    }
  }

  private context(id: string) {
    return JSON.stringify(['condotel', 'reservation-notes', 1, id]);
  }
  private unavailable() {
    return new ServiceUnavailableException(
      'Encrypted reservation notes could not be authenticated or decrypted.',
    );
  }
}
