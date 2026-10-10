import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { PaymongoService } from './paymongo.service';

describe('PayMongo boundary', () => {
  const secret = randomBytes(32).toString('base64');
  const config = {
    PAYMONGO_SECRET_KEY: 'sk_test_' + randomBytes(16).toString('hex'),
    PAYMONGO_WEBHOOK_SECRET: secret,
    FRONTEND_URL: 'http://localhost:5173',
  };
  const provider = new PaymongoService(new ConfigService(config));
  function signed(
    body: string,
    time = Math.floor(Date.now() / 1000),
    field = 'te',
  ) {
    return `t=${time},${field}=${createHmac('sha256', secret)
      .update(time + '.' + body)
      .digest('hex')}`;
  }
  const payload = {
    data: {
      type: 'checkout_session.payment.paid',
      livemode: false,
      data: { id: 'cs_Test123', attributes: { reference_number: 'payment' } },
    },
  };
  it('authenticates exact raw bytes and rejects stale, wrong-mode, missing and forged signatures', () => {
    const body = JSON.stringify(payload);
    expect(provider.paidEvent(Buffer.from(body), signed(body))?.id).toBe(
      'cs_Test123',
    );
    for (const signature of [
      undefined,
      'invalid',
      signed(body, Math.floor(Date.now() / 1000) - 600),
      signed(body, Math.floor(Date.now() / 1000), 'li'),
    ])
      expect(() => provider.paidEvent(Buffer.from(body), signature)).toThrow();
    expect(() =>
      provider.paidEvent(Buffer.from(body + ' '), signed(body)),
    ).toThrow();
    const live = JSON.stringify({ data: { ...payload.data, livemode: true } });
    expect(() => provider.paidEvent(Buffer.from(live), signed(live))).toThrow(
      'Invalid payment webhook payload',
    );
  });
  it('supports authenticated legacy envelopes and ignores unrelated events', () => {
    const body = JSON.stringify({ data: { attributes: payload.data } });
    expect(provider.paidEvent(Buffer.from(body), signed(body))?.id).toBe(
      'cs_Test123',
    );
    const unrelated = JSON.stringify({
      data: { ...payload.data, type: 'payment.failed' },
    });
    expect(
      provider.paidEvent(Buffer.from(unrelated), signed(unrelated)),
    ).toBeNull();
  });
  it('rejects arbitrary redirects and unconfigured checkout', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://evil.test/checkout',
      'http://checkout.paymongo.com/test',
      'https://user:secret@checkout.paymongo.com/',
    ])
      expect(() =>
        provider.checkoutUrl({
          id: 'cs_test',
          attributes: { checkout_url: url },
        }),
      ).toThrow();
    expect(() =>
      new PaymongoService(new ConfigService({})).assertConfigured(),
    ).toThrow();
    expect(() =>
      new PaymongoService(
        new ConfigService({ ...config, PAYMONGO_SECRET_KEY: 'sk_live_test' }),
      ).assertConfigured(),
    ).toThrow('HTTPS');
  });
  it('never reflects provider error bodies containing billing or API secrets', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          email: 'private@example.test',
          key: config.PAYMONGO_SECRET_KEY,
        }),
        { status: 400 },
      ),
    );
    try {
      await expect(
        provider.create({
          reference: 'payment',
          amount: 10000,
          billing: { name: 'Name', email: 'private@example.test', phone: null },
        }),
      ).rejects.toThrow('Payment provider unavailable');
      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string).data
        .attributes;
      expect(body.billing).not.toHaveProperty('phone');
      expect(body).not.toHaveProperty('specialRequests');
    } finally {
      fetchMock.mockRestore();
    }
  });
});
