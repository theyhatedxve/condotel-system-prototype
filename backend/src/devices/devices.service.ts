import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import type { EncryptedValue } from '../security/encryption.service';

// Explicit selection prevents encrypted key material from leaking into list responses.
const deviceDetails = {
  deviceId: true,
  deviceName: true,
  createdAt: true,
} satisfies Prisma.DeviceSelect;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  list() {
    return this.prisma.device.findMany({
      select: deviceDetails,
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(deviceName: string) {
    const deviceSecret = this.encryption.generateRandomKey();
    let encrypted: EncryptedValue;
    try {
      encrypted = this.encryption.encrypt(deviceSecret);
    } catch {
      // Fail before persistence and never return configuration values or raw crypto errors.
      throw new ServiceUnavailableException(
        'Device encryption is unavailable. Check the backend AES master key configuration.',
      );
    }
    try {
      const device = await this.prisma.device.create({
        data: {
          deviceName,
          deviceKeyCiphertext: encrypted.ciphertext,
          deviceKeyIv: encrypted.iv,
          deviceKeyAuthTag: encrypted.authTag,
        },
        select: deviceDetails,
      });
      // Only the initial registration response contains the secret for device provisioning.
      return { device, deviceSecret };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A device with this name is already registered.',
        );
      }
      throw error;
    }
  }
}
