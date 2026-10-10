import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactProtectionService } from './contact-protection.service';

@Injectable()
export class PrivacyReadinessService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactProtectionService,
  ) {}
  async onApplicationBootstrap() {
    try {
      this.contacts.index('email', 'startup-key-check');
    } catch {
      throw new Error(
        'Encryption startup configuration is invalid. AES_MASTER_KEY and CONTACT_SEARCH_KEY must be separate 32-byte Base64 keys. Preserve existing keys; initialize only a missing first-time search key with npm run privacy:init-search-key. For an already encrypted database, restore its matching keys. Follow PRIVACY.md before restarting.',
      );
    }
    const protections = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE name IN
      ('User_encrypted_INSERT','User_encrypted_UPDATE','Reservation_encrypted_INSERT','Reservation_encrypted_UPDATE','User_emailBlindIndex_key')`;
    if (protections.length !== 5)
      throw new Error(
        'Privacy migration is not finalized. Keep the server offline and follow PRIVACY.md.',
      );
    const sample = await this.prisma.user.findFirst();
    if (sample) this.contacts.verify(sample);
  }
}
