// Coordinates account persistence, password verification and issuance of signed access tokens.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  ContactProtectionService,
  normalizeEmail,
} from '../security/contact-protection.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';

// Explicit projection keeps password hashes out of responses and request.user.
export const publicUser = {
  id: true,
  emailCiphertext: true,
  emailIv: true,
  emailAuthTag: true,
  emailBlindIndex: true,
  username: true,
  firstName: true,
  lastName: true,
  phoneCiphertext: true,
  phoneIv: true,
  phoneAuthTag: true,
  phoneBlindIndex: true,
  role: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type ContactUser = Prisma.UserGetPayload<{
  select: typeof publicUser;
}>;
export type AuthenticatedUser = Omit<
  ContactUser,
  | 'emailCiphertext'
  | 'emailIv'
  | 'emailAuthTag'
  | 'emailBlindIndex'
  | 'phoneCiphertext'
  | 'phoneIv'
  | 'phoneAuthTag'
  | 'phoneBlindIndex'
> & {
  email: string;
  phone: string | null;
};

// An explicit allowlist prevents ciphertext, indexes, legacy columns and hashes escaping.
export function userResponse(
  user: ContactUser,
  contact: { email: string; phone: string | null },
): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...contact,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly contacts: ContactProtectionService,
  ) {}

  async register(dto: RegisterDto) {
    const id = randomUUID();
    const encrypted = this.contacts.write(id, dto);
    // Passwords use one-way Argon2id hashing because authentication requires verification,
    // not reversible storage; only the resulting hash is persisted.
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    try {
      const user = await this.prisma.user.create({
        data: {
          id,
          ...encrypted,
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
        },
        select: publicUser,
      });
      return {
        message: 'Registration successful.',
        user: userResponse(user, this.contacts.readOwn(user, id)),
      };
    } catch (error) {
      // Database uniqueness enforcement also catches competing registrations for the same identity.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or username is already registered.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { emailBlindIndex: this.contacts.index('email', dto.identifier) },
          { username: normalizeEmail(dto.identifier) },
        ],
      },
    });
    // Missing accounts, inactive accounts and incorrect passwords share the same failure response.
    // Argon2id verifies the stored hash without recovering the original password.
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email/username or password.');
    }
    const safeUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: publicUser,
    });
    // Sign only after successful verification; the subject identifies the account without embedding its data.
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      message: 'Login successful.',
      accessToken,
      tokenType: 'Bearer',
      user: userResponse(safeUser, this.contacts.readOwn(safeUser, user.id)),
    };
  }

  async findAuthenticatedUser(id: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUser,
    });
    // Recheck the account on each request; a valid token alone is insufficient.
    if (!user || user.status !== 'ACTIVE')
      throw new UnauthorizedException('User account is unavailable.');
    return userResponse(user, this.contacts.readOwn(user, id));
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await argon2.verify(user.passwordHash, dto.currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (await argon2.verify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }
    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      select: publicUser,
    });
    return {
      message: 'Password changed successfully.',
      user: userResponse(
        updatedUser,
        this.contacts.readOwn(updatedUser, userId),
      ),
    };
  }
}
