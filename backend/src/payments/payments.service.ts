import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, requireActive, requireAdmin } from '../security/access';
import { ContactProtectionService } from '../security/contact-protection.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CheckoutSession, PaymongoService } from './paymongo.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly contacts: ContactProtectionService,
    private readonly paymongo: PaymongoService,
  ) {}

  async checkout(actor: Actor, reservationId: string) {
    const reservation = await this.reservations.authorized(
      actor,
      reservationId,
    );
    if (!['PENDING', 'CONFIRMED'].includes(reservation.status))
      throw new ConflictException(
        'Reservation cannot be paid in its current state.',
      );
    this.paymongo.assertConfigured();
    const existing = await this.prisma.payment.findUnique({
      where: { reservationId },
    });
    if (existing) {
      if (existing.status === 'READY' && existing.checkoutUrl)
        return { id: existing.id, checkoutUrl: existing.checkoutUrl };
      throw new ConflictException(
        existing.status === 'PAID'
          ? 'Reservation is already paid.'
          : 'Checkout needs reconciliation by staff before retrying.',
      );
    }
    // Decrypt only after reservation authorization and only for provider billing.
    const billing = {
      name: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      ...this.contacts.readAuthorized(reservation.guest, actor),
    };
    const payment = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      if (!['PENDING', 'CONFIRMED'].includes(latest.status))
        throw new ConflictException(
          'Reservation changed; reload before paying.',
        );
      return tx.payment.create({
        data: { reservationId, amountCentavos: latest.totalAmountCentavos },
      });
    });
    try {
      const session = await this.paymongo.create({
        reference: payment.id,
        amount: payment.amountCentavos,
        billing,
      });
      const checkoutUrl = this.paymongo.checkoutUrl(session);
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'CREATING' },
        data: {
          paymongoCheckoutSessionId: session.id,
          checkoutUrl,
          status: 'READY',
        },
      });
      return { id: payment.id, checkoutUrl };
    } catch (error) {
      // A timeout may still have created a remote session. Never automatically create a second charge.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'CREATING' },
        data: { status: 'UNKNOWN' },
      });
      throw error;
    }
  }

  async list(actor: Actor) {
    requireActive(actor);
    return this.prisma.payment.findMany({
      where:
        actor.role === 'CUSTOMER' ? { reservation: { guestId: actor.id } } : {},
      select: {
        id: true,
        reservationId: true,
        amountCentavos: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async webhook(raw: Buffer | undefined, signature: string | undefined) {
    const session = this.paymongo.paidEvent(raw, signature);
    if (session) await this.recordPaid(session);
    return { received: true };
  }

  async reconcile(actor: Actor, id: string, sessionId: string) {
    requireAdmin(actor);
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found.');
    const session = await this.paymongo.retrieve(sessionId);
    if (
      session.attributes.reference_number !== id ||
      (payment.paymongoCheckoutSessionId &&
        payment.paymongoCheckoutSessionId !== session.id)
    )
      throw new BadRequestException('Checkout reference mismatch.');
    if (
      session.attributes.payments?.some((p) => p.attributes.status === 'paid')
    ) {
      await this.recordPaid(session);
    } else {
      const items = session.attributes.line_items;
      if (
        !items?.length ||
        items.some((item) => item.currency !== 'PHP') ||
        items.reduce((sum, item) => sum + item.amount * item.quantity, 0) !==
          payment.amountCentavos
      )
        throw new BadRequestException('Checkout amount mismatch.');
      const checkoutUrl = this.paymongo.checkoutUrl(session);
      await this.prisma.payment.updateMany({
        where: { id, status: { not: 'PAID' } },
        data: {
          paymongoCheckoutSessionId: session.id,
          checkoutUrl,
          status: 'READY',
        },
      });
    }
    return { reconciled: true };
  }

  private async recordPaid(session: CheckoutSession) {
    const reference = session.attributes.reference_number;
    if (!reference)
      throw new BadRequestException('Missing checkout reference.');
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: reference },
        include: { reservation: true },
      });
      // Ignore events belonging to other apps using this merchant account.
      if (!payment) return;
      if (
        payment.paymongoCheckoutSessionId &&
        payment.paymongoCheckoutSessionId !== session.id
      )
        throw new BadRequestException('Checkout reference mismatch.');
      const paid = session.attributes.payments?.filter(
        (p) => p.attributes.status === 'paid',
      );
      if (
        !paid?.length ||
        paid.some((p) => p.attributes.currency !== 'PHP') ||
        paid.reduce((sum, p) => sum + p.attributes.amount, 0) !==
          payment.amountCentavos
      )
        throw new BadRequestException('Paid amount or currency mismatch.');
      if (payment.status === 'PAID') return;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymongoCheckoutSessionId: session.id,
        },
      });
      await tx.reservation.updateMany({
        where: { id: payment.reservationId, status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });
      await tx.notification.upsert({
        where: { dedupeKey: `payment:${payment.id}:paid` },
        update: {},
        create: {
          userId: payment.reservation.guestId,
          type: 'PAYMENT_PAID',
          message: 'Payment received for your reservation.',
          entityId: payment.reservationId,
          dedupeKey: `payment:${payment.id}:paid`,
        },
      });
    });
  }
}
