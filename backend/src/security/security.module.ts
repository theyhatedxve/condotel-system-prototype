import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { ContactProtectionService } from './contact-protection.service';
import { ReservationNotesService } from './reservation-notes.service';

@Module({
  imports: [ConfigModule],
  providers: [
    EncryptionService,
    ContactProtectionService,
    ReservationNotesService,
  ],
  exports: [
    EncryptionService,
    ContactProtectionService,
    ReservationNotesService,
  ],
})
export class SecurityModule {}
