import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { publicUser } from '../auth/auth.service';
import {
  Actor,
  requireActive,
  requireOwnerOrStaff,
  requireStaff,
} from '../security/access';
import { ContactProtectionService } from '../security/contact-protection.service';
import { ReservationNotesService } from '../security/reservation-notes.service';
import {
  CreateReservationDto,
  CreateRoomDto,
  UpdateReservationDto,
  UpdateRoomDto,
} from './reservations.dto';

const include = {
  room: true,
  guest: { select: publicUser },
} satisfies Prisma.ReservationInclude;
type Booking = Prisma.ReservationGetPayload<{ include: typeof include }>;
export const todayAtHotel = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactProtectionService,
    private readonly notes: ReservationNotesService,
  ) {}

  async rooms(actor: Actor) {
    requireActive(actor);
    const rows = await this.prisma.room.findMany({
      where: actor.role === 'CUSTOMER' ? { isActive: true } : {},
      include: {
        _count: {
          select: { reservations: { where: { status: 'CHECKED_IN' } } },
        },
      },
      orderBy: { roomNumber: 'asc' },
      take: 500,
    });
    return rows.map(({ _count, ...room }) => ({
      ...room,
      status: _count.reservations ? 'OCCUPIED' : room.status,
    }));
  }
  async createRoom(actor: Actor, dto: CreateRoomDto) {
    requireStaff(actor);
    return this.prisma.room.create({ data: dto });
  }
  async updateRoom(actor: Actor, id: string, dto: UpdateRoomDto) {
    requireStaff(actor);
    return this.prisma.room.update({ where: { id }, data: dto });
  }

  async dashboard(actor: Actor) {
    requireActive(actor);
    const scope = actor.role === 'CUSTOMER' ? { guestId: actor.id } : {};
    const date = new Date(todayAtHotel() + 'T00:00:00Z');
    const tomorrow = new Date(date.getTime() + 86400000);
    const paidStart = new Date(date.getTime() - 8 * 3600000);
    const paidEnd = new Date(paidStart.getTime() + 86400000);
    const [
      rooms,
      current,
      todayCheckIns,
      todayCheckOuts,
      paid,
      recentReservations,
    ] = await Promise.all([
      this.rooms(actor),
      this.prisma.reservation.aggregate({
        where: { ...scope, status: 'CHECKED_IN' },
        _sum: { adults: true, children: true },
      }),
      this.prisma.reservation.count({
        where: {
          ...scope,
          status: { not: 'CANCELLED' },
          checkIn: { gte: date, lt: tomorrow },
        },
      }),
      this.prisma.reservation.count({
        where: {
          ...scope,
          status: { not: 'CANCELLED' },
          checkOut: { gte: date, lt: tomorrow },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          reservation: scope,
          status: 'PAID',
          paidAt: { gte: paidStart, lt: paidEnd },
        },
        _sum: { amountCentavos: true },
        _count: true,
      }),
      // The dashboard only displays names/dates; it does not need contacts or notes decrypted.
      this.prisma.reservation.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { roomNumber: true } },
        },
      }),
    ]);
    const active = rooms.filter((room) => room.isActive);
    const occupiedRooms = active.filter(
      (room) => room.status === 'OCCUPIED',
    ).length;
    const maintenanceRooms = active.filter(
      (room) => room.status === 'MAINTENANCE',
    ).length;
    return {
      statistics: {
        totalRooms: active.length,
        currentGuests:
          (current._sum.adults ?? 0) + (current._sum.children ?? 0),
        todayCheckIns,
        todayCheckOuts,
        todayPaymentsCentavos: paid._sum.amountCentavos ?? 0,
        todayPaymentCount: paid._count,
      },
      occupancy: {
        occupiedRooms,
        maintenanceRooms,
        availableRooms: active.length - occupiedRooms - maintenanceRooms,
        occupancyPercent: active.length
          ? Math.round((100 * occupiedRooms) / active.length)
          : 0,
      },
      recentReservations: recentReservations.slice(0, 5),
    };
  }

  async create(actor: Actor, dto: CreateReservationDto) {
    requireActive(actor);
    const guestId = dto.guestId || actor.id;
    requireOwnerOrStaff(actor, guestId);
    const checkIn = new Date(dto.checkIn + 'T00:00:00.000Z');
    const checkOut = new Date(dto.checkOut + 'T00:00:00.000Z');
    const nights = (checkOut.getTime() - checkIn.getTime()) / 86400000;
    if (
      !Number.isInteger(nights) ||
      nights < 1 ||
      nights > 365 ||
      checkIn.toISOString().slice(0, 10) !== dto.checkIn ||
      checkOut.toISOString().slice(0, 10) !== dto.checkOut ||
      dto.checkIn < todayAtHotel()
    ) {
      throw new BadRequestException(
        'Choose valid dates from today, with checkout 1 to 365 nights after check-in.',
      );
    }
    const id = randomUUID();
    const encrypted = this.notes.write(
      id,
      this.withArrival(dto.specialRequests ?? null, dto.estimatedArrival),
    );
    const row = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.user.findUnique({
        where: { id: guestId },
        select: { status: true },
      });
      if (!guest || guest.status !== 'ACTIVE')
        throw new BadRequestException('Guest account is unavailable.');
      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room || !room.isActive || room.status !== 'AVAILABLE')
        throw new ConflictException('Room is unavailable.');
      if (dto.adults + (dto.children ?? 0) > room.capacity)
        throw new BadRequestException('Guest count exceeds room capacity.');
      const overlap = await tx.reservation.count({
        where: {
          roomId: room.id,
          status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      });
      if (overlap)
        throw new ConflictException('Room is already booked for these dates.');
      const booking = await tx.reservation.create({
        data: {
          id,
          referenceNo: 'RES-' + id,
          guestId,
          roomId: room.id,
          checkIn,
          checkOut,
          adults: dto.adults,
          children: dto.children ?? 0,
          totalAmountCentavos: nights * room.ratePerNightCentavos,
          ...encrypted,
        },
        include,
      });
      await tx.notification.create({
        data: {
          userId: guestId,
          type: 'RESERVATION_CREATED',
          message: 'Your reservation was created.',
          entityId: id,
          dedupeKey: `reservation:${id}:created`,
        },
      });
      return booking;
    });
    return this.response(row, actor);
  }

  async list(actor: Actor, status?: string, page = 1) {
    requireActive(actor);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      (status &&
        ![
          'PENDING',
          'CONFIRMED',
          'CHECKED_IN',
          'CHECKED_OUT',
          'CANCELLED',
        ].includes(status))
    )
      throw new BadRequestException('Invalid reservation filter.');
    const rows = await this.prisma.reservation.findMany({
      where: {
        ...(actor.role === 'CUSTOMER' ? { guestId: actor.id } : {}),
        ...(status ? { status } : {}),
      },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
      skip: (page - 1) * 50,
    });
    return rows.map((row) => this.response(row, actor));
  }
  async get(actor: Actor, id: string) {
    const row = await this.authorized(actor, id);
    return this.response(row, actor);
  }
  async authorized(actor: Actor, id: string): Promise<Booking> {
    requireActive(actor);
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException('Reservation not found.');
    requireOwnerOrStaff(actor, row.guestId);
    return row;
  }
  async update(actor: Actor, id: string, dto: UpdateReservationDto) {
    const existing = await this.authorized(actor, id);
    if (['CANCELLED', 'CHECKED_OUT'].includes(existing.status))
      throw new ConflictException('This reservation is closed.');
    if (dto.status && dto.status !== 'CANCELLED') requireStaff(actor);
    const transitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
      CHECKED_IN: ['CHECKED_OUT'],
    };
    if (dto.status && !transitions[existing.status]?.includes(dto.status))
      throw new ConflictException('Invalid reservation status transition.');
    const encrypted =
      dto.specialRequests !== undefined || dto.estimatedArrival !== undefined
        ? this.notes.write(
            id,
            this.withArrival(
              dto.specialRequests === undefined
                ? this.notes.read(existing, actor)
                : dto.specialRequests,
              dto.estimatedArrival,
            ),
          )
        : {};
    const row = await this.prisma.$transaction(async (tx) => {
      if (
        dto.status === 'CANCELLED' &&
        (await tx.payment.count({ where: { reservationId: id } }))
      ) {
        throw new ConflictException(
          'A checkout exists. Contact staff to reconcile payment and cancellation before releasing this booking.',
        );
      }
      const changed = await tx.reservation.updateMany({
        where: { id, updatedAt: existing.updatedAt },
        data: { ...encrypted, ...(dto.status ? { status: dto.status } : {}) },
      });
      if (changed.count !== 1)
        throw new ConflictException('Reservation changed; reload and retry.');
      if (dto.status)
        await tx.notification.create({
          data: {
            userId: existing.guestId,
            type: 'RESERVATION_UPDATED',
            message: `Reservation status: ${dto.status}.`,
            entityId: id,
            dedupeKey: `reservation:${id}:${dto.status}`,
          },
        });
      return tx.reservation.findUniqueOrThrow({ where: { id }, include });
    });
    return this.response(row, actor);
  }

  private withArrival(
    requests: string | null,
    arrival?: string,
  ): string | null {
    // Append the optional arrival note without stripping or rewriting the customer's text.
    const result = arrival
      ? [requests, `Estimated arrival: ${arrival}`]
          .filter((v) => v !== null && v !== '')
          .join('\n')
      : requests;
    if (result !== null && result.length > 5000)
      throw new BadRequestException(
        'Special requests including arrival notes must not exceed 5000 characters.',
      );
    return result;
  }
  private response(row: Booking, actor: Actor) {
    requireOwnerOrStaff(actor, row.guestId);
    const contact = this.contacts.readAuthorized(row.guest, actor);
    return {
      id: row.id,
      referenceNo: row.referenceNo,
      guestId: row.guestId,
      roomId: row.roomId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      adults: row.adults,
      children: row.children,
      totalAmountCentavos: row.totalAmountCentavos,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      specialRequests: this.notes.read(row, actor),
      room: row.room,
      guest: {
        id: row.guest.id,
        firstName: row.guest.firstName,
        lastName: row.guest.lastName,
        ...contact,
      },
    };
  }
}
