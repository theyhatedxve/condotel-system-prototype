import 'reflect-metadata';
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { CreateManagedUserDto } from '../src/users/users.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { EncryptionService } from '../src/security/encryption.service';
import { ContactProtectionService } from '../src/security/contact-protection.service';
import { PrivacyReadinessService } from '../src/security/privacy-readiness.service';

// Offline operator provisioning/seed. Input arrives through stdin, never command arguments or logs.
async function main() {
  const [databasePath, confirmation] = process.argv.slice(2);
  if (
    !databasePath ||
    !existsSync(databasePath) ||
    confirmation !== '--operator-provisioning'
  )
    throw new Error();
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (input.length > 16384) throw new Error();
  }
  const dto = plainToInstance(CreateManagedUserDto, JSON.parse(input));
  if (
    Array.isArray(dto) ||
    (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
      .length
  )
    throw new Error();
  const config = new ConfigService({
    ...process.env,
    DATABASE_URL: 'file:' + resolve(databasePath).replaceAll('\\', '/'),
  });
  const prisma = new PrismaService(config);
  try {
    const contacts = new ContactProtectionService(
      new EncryptionService(config),
    );
    await prisma.$connect();
    await new PrivacyReadinessService(
      prisma,
      contacts,
    ).onApplicationBootstrap();
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        ...contacts.write(id, dto),
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? 'CUSTOMER',
        mustChangePassword: true,
        passwordHash: await argon2.hash(dto.password, {
          type: argon2.argon2id,
        }),
      },
    });
    process.stdout.write('Account created: ' + id + '\n');
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Account creation failed. Check validated input, uniqueness, keys and migration readiness.\n',
  );
  process.exitCode = 1;
});
