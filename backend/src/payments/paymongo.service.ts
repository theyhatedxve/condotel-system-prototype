import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CheckoutSession {
  id: string;
  attributes: {
    checkout_url?: string;
    reference_number?: string;
    livemode?: boolean;
    line_items?: Array<{ amount: number; currency: string; quantity: number }>;
    payments?: Array<{
      id: string;
      attributes: { amount: number; currency: string; status: string };
    }>;
  };
}
export interface CheckoutInput {
  reference: string;
  amount: number;
  billing: { name: string; email: string; phone: string | null };
}

@Injectable()
export class PaymongoService {
  constructor(private readonly config: ConfigService) {}
  assertConfigured() {
    const key = this.config.get<string>('PAYMONGO_SECRET_KEY');
    const secret = this.config.get<string>('PAYMONGO_WEBHOOK_SECRET');
    const origin = this.config.get<string>('FRONTEND_URL');
    if (!key || !/^sk_(test|live)_/.test(key) || !secret || !origin)
      throw new ServiceUnavailableException(
        'Payment checkout is not configured.',
      );
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' &&
      !(
        key.startsWith('sk_test_') &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      throw new ServiceUnavailableException(
        'Payment return URL must use HTTPS.',
      );
  }
  private isLive() {
    return (
      this.config.get<string>('PAYMONGO_SECRET_KEY')?.startsWith('sk_live_') ===
      true
    );
  }

  async create(input: CheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured();
    const base = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const methods = (
      this.config.get<string>('PAYMONGO_PAYMENT_METHODS') || 'card,gcash'
    )
      .split(',')
      .map((v) => v.trim());
    return this.call('/v2/checkout_sessions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: input.billing.name,
              email: input.billing.email,
              ...(input.billing.phone ? { phone: input.billing.phone } : {}),
            },
            line_items: [
              {
                name: 'Condotel reservation',
                amount: input.amount,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: methods,
            reference_number: input.reference,
            success_url: `${base}/admin/reservations?payment=return`,
            cancel_url: `${base}/admin/reservations`,
            send_email_receipt: true,
            pass_on_fees: false,
          },
        },
      }),
    });
  }
  async retrieve(id: string) {
    if (!/^cs_[a-zA-Z0-9]+$/.test(id))
      throw new BadRequestException('Invalid checkout session ID.');
    return this.call(`/v1/checkout_sessions/${id}`, { method: 'GET' });
  }
  private async call(
    path: string,
    init: RequestInit,
  ): Promise<CheckoutSession> {
    this.assertConfigured();
    try {
      const response = await fetch('https://api.paymongo.com' + path, {
        ...init,
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from(
              this.config.getOrThrow<string>('PAYMONGO_SECRET_KEY') + ':',
            ).toString('base64'),
        },
      });
      if (!response.ok) throw new Error('Provider request failed.');
      const body = (await response.json()) as { data: CheckoutSession };
      if (
        !body.data ||
        !/^cs_[a-zA-Z0-9]+$/.test(body.data.id) ||
        typeof body.data.attributes !== 'object' ||
        !body.data.attributes
      )
        throw new Error('Invalid checkout.');
      if (body.data.attributes.livemode !== this.isLive())
        throw new Error('Payment mode mismatch.');
      return body.data;
    } catch {
      // Provider responses/errors may echo billing contacts or keys. Do not persist or log them.
      throw new ServiceUnavailableException(
        'Payment provider unavailable. Staff can reconcile this checkout before retrying.',
      );
    }
  }
  checkoutUrl(session: CheckoutSession): string {
    try {
      const url = new URL(session.attributes.checkout_url!);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'checkout.paymongo.com' ||
        url.username ||
        url.password
      )
        throw new Error();
      return url.href;
    } catch {
      throw new ServiceUnavailableException(
        'Payment provider returned an invalid checkout URL.',
      );
    }
  }

  paidEvent(
    raw: Buffer | undefined,
    signature: string | undefined,
  ): CheckoutSession | null {
    this.assertConfigured();
    if (!raw || !signature)
      throw new UnauthorizedException('Invalid payment webhook signature.');
    const fields = Object.fromEntries(
      signature.split(',').map((part) => part.trim().split('=')),
    );
    const timestamp = fields.t;
    const digest = fields[this.isLive() ? 'li' : 'te'];
    if (
      !/^\d+$/.test(timestamp ?? '') ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[0-9a-f]{64}$/i.test(digest ?? '')
    )
      throw new UnauthorizedException('Invalid payment webhook signature.');
    const expected = createHmac(
      'sha256',
      this.config.getOrThrow<string>('PAYMONGO_WEBHOOK_SECRET'),
    )
      .update(timestamp + '.')
      .update(raw)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(digest, 'hex')))
      throw new UnauthorizedException('Invalid payment webhook signature.');
    try {
      // Support documented hosted-checkout and legacy event envelopes. No raw payload storage.
      const payload = JSON.parse(raw.toString('utf8')) as {
        data: {
          type: string;
          livemode: boolean;
          data: CheckoutSession;
          attributes?: {
            type: string;
            livemode: boolean;
            data: CheckoutSession;
          };
        };
      };
      const event = payload.data.attributes ?? payload.data;
      if (event.livemode !== this.isLive()) throw new Error();
      if (event.type !== 'checkout_session.payment.paid') return null;
      if (!/^cs_[a-zA-Z0-9]+$/.test(event.data?.id) || !event.data.attributes)
        throw new Error();
      return event.data;
    } catch {
      throw new BadRequestException('Invalid payment webhook payload.');
    }
  }
}
