// Registers the encryption provider and controller; AuthModule supplies the guard for protected access.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from './encryption.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [AuthModule],
  controllers: [SecurityController],
  providers: [EncryptionService],
})
export class SecurityModule {}
