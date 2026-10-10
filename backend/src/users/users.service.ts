import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ContactProtectionService } from '../security/contact-protection.service';
import {
  Actor,
  requireActive,
  requireAdmin,
  requireStaff,
} from '../security/access';
import { publicUser, userResponse } from '../auth/auth.service';
import { Prisma } from '../generated/prisma/client';
import {
  CreateManagedUserDto,
  UpdateManagedUserDto,
  UpdateProfileDto,
} from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactProtectionService,
  ) {}

  async list(actor: Actor, query = '', page = 1, guestsOnly = false) {
    requireStaff(actor);
    if (!guestsOnly) requireAdmin(actor);
    if (
      typeof query !== 'string' ||
      query.length > 255 ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new BadRequestException('Invalid search or page.');
    const q = query.trim();
    const where: Prisma.UserWhereInput = {
      ...(guestsOnly ? { role: 'CUSTOMER' } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { username: { contains: q.toLowerCase() } },
              { emailBlindIndex: this.contacts.index('email', q) },
              { phoneBlindIndex: this.contacts.index('phone', q) },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.user.findMany({
      where,
      select: publicUser,
      orderBy: { id: 'asc' },
      take: 50,
      skip: (page - 1) * 50,
    });
    return rows.map((row) =>
      userResponse(row, this.contacts.readAuthorized(row, actor)),
    );
  }

  async updateOwn(actor: Actor, dto: UpdateProfileDto) {
    requireActive(actor);
    return this.updateRecord(actor, actor.id, dto);
  }

  async update(
    actor: Actor,
    id: string,
    dto: UpdateManagedUserDto,
    guestOnly = false,
  ) {
    requireStaff(actor);
    if (!guestOnly) requireAdmin(actor);
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target || (guestOnly && target.role !== 'CUSTOMER'))
      throw new NotFoundException('Account not found.');
    if (dto.role !== undefined || dto.status !== undefined) requireAdmin(actor);
    if (
      actor.id === id &&
      ((dto.status && dto.status !== 'ACTIVE') ||
        (dto.role && dto.role !== actor.role))
    ) {
      throw new BadRequestException(
        'You cannot disable or demote your own account.',
      );
    }
    return this.updateRecord(actor, id, dto);
  }

  private async updateRecord(
    actor: Actor,
    id: string,
    dto: UpdateManagedUserDto,
  ) {
    const { email, phone, ...profile } = dto;
    const data = { ...profile, ...this.contacts.write(id, { email, phone }) };
    const row = await this.prisma.user.update({
      where: { id },
      data,
      select: publicUser,
    });
    return userResponse(row, this.contacts.readAuthorized(row, actor));
  }

  async create(actor: Actor, dto: CreateManagedUserDto, guestOnly = false) {
    requireStaff(actor);
    if (!guestOnly) requireAdmin(actor);
    if (guestOnly && dto.role && dto.role !== 'CUSTOMER')
      throw new ForbiddenException('Guest accounts must be customers.');
    if (dto.role && dto.role !== 'CUSTOMER') requireAdmin(actor);
    const data = await this.creationData(dto);
    const row = await this.prisma.user.create({ data, select: publicUser });
    return userResponse(row, this.contacts.readAuthorized(row, actor));
  }

  async import(actor: Actor, users: CreateManagedUserDto[]) {
    requireAdmin(actor);
    // Validate and encrypt everything before opening a transaction. Any duplicate rolls back the batch.
    // Argon2 is memory-hard. Hash sequentially so a 50-row import does not allocate 50 workspaces.
    const records = [];
    for (const dto of users) records.push(await this.creationData(dto));
    try {
      const rows = await this.prisma.$transaction(
        records.map((data) =>
          this.prisma.user.create({ data, select: { id: true } }),
        ),
      );
      return { imported: rows.length, ids: rows.map((row) => row.id) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Import contains an existing or duplicate email/username; no accounts were imported.',
        );
      throw error;
    }
  }

  private async creationData(dto: CreateManagedUserDto) {
    const id = randomUUID();
    return {
      id,
      ...this.contacts.write(id, dto),
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
      role: dto.role ?? 'CUSTOMER',
      mustChangePassword: true,
      passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
    };
  }
}
