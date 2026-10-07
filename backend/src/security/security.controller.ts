import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.service';
import { EncryptionService } from './encryption.service';

class EncryptDemoDto {
  @IsString()
  @MaxLength(4096)
  text: string;
}

class DecryptDemoDto {
  @IsString()
  @MaxLength(22000)
  ciphertext: string;

  @IsString()
  @Length(16, 16)
  iv: string;

  @IsString()
  @Length(24, 24)
  authTag: string;
}

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly encryption: EncryptionService) {}

  @Post('encrypt-demo')
  @HttpCode(200)
  encrypt(
    @Req() request: { user: AuthenticatedUser },
    @Body() dto: EncryptDemoDto,
  ) {
    this.checkPassword(request.user);
    try {
      return this.encryption.encrypt(dto.text);
    } catch {
      throw new ServiceUnavailableException(
        'Encryption is unavailable. Configure a valid backend AES_MASTER_KEY.',
      );
    }
  }

  @Post('decrypt-demo')
  @HttpCode(200)
  decrypt(
    @Req() request: { user: AuthenticatedUser },
    @Body() dto: DecryptDemoDto,
  ) {
    this.checkPassword(request.user);
    try {
      return { text: this.encryption.decrypt(dto) };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Encrypted value could not be decrypted.'
      ) {
        throw new BadRequestException(
          'Decryption failed. The ciphertext, IV, or authentication tag is invalid or has been changed.',
        );
      }
      throw new ServiceUnavailableException(
        'Encryption is unavailable. Configure a valid backend AES_MASTER_KEY.',
      );
    }
  }

  private checkPassword(user: AuthenticatedUser) {
    if (user.mustChangePassword)
      throw new ForbiddenException(
        'Change your temporary password before using the security demo.',
      );
  }
}
