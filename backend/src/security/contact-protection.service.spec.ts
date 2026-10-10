import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import {
  ContactProtectionService,
  StoredContacts,
} from './contact-protection.service';
import { EncryptionService } from './encryption.service';
import { ReservationNotesService } from './reservation-notes.service';

describe('Contact and reservation privacy', () => {
  let encryption: EncryptionService;
  let contacts: ContactProtectionService;
  let notes: ReservationNotesService;
  let settings: Record<string, string>;
  const owner = {
    id: 'owner',
    status: 'ACTIVE',
    role: 'CUSTOMER',
    mustChangePassword: false,
  };
  const other = { ...owner, id: 'other' };
  beforeEach(() => {
    settings = {
      AES_MASTER_KEY: randomBytes(32).toString('base64'),
      CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
    };
    encryption = new EncryptionService(new ConfigService(settings));
    contacts = new ContactProtectionService(encryption);
    notes = new ReservationNotesService(encryption);
  });
  function row(
    email = ' Person@EXAMPLE.TEST ',
    phone: string | null = ' +63 (900) 123 ',
  ) {
    return {
      id: owner.id,
      ...contacts.write(owner.id, { email, phone }),
    } as StoredContacts;
  }
  it('round-trips normalized contacts with fresh IVs and stable field-separated keyed indexes', () => {
    const first = row(),
      second = row();
    expect(contacts.readAuthorized(first, owner)).toEqual({
      email: 'person@example.test',
      phone: '+63 (900) 123',
    });
    expect(first.emailIv).not.toBe(second.emailIv);
    expect(first.emailCiphertext).not.toBe(second.emailCiphertext);
    expect(first.emailBlindIndex).toBe(second.emailBlindIndex);
    expect(contacts.index('email', ' SAME ')).not.toBe(
      contacts.index('phone', 'same'),
    );
    expect(contacts.index('phone', '+63900123')).not.toBe(
      first.phoneBlindIndex,
    );
    settings.CONTACT_SEARCH_KEY = randomBytes(32).toString('base64');
    expect(
      new ContactProtectionService(
        new EncryptionService(new ConfigService(settings)),
      ).index('email', 'person@example.test'),
    ).not.toBe(first.emailBlindIndex);
  });
  it('rejects encryption-key reuse as a search key', () => {
    const reused = new EncryptionService(
      new ConfigService({
        AES_MASTER_KEY: settings.AES_MASTER_KEY,
        CONTACT_SEARCH_KEY: settings.AES_MASTER_KEY,
      }),
    );
    expect(() => reused.blindIndex('email', 'test')).toThrow(
      'must be different',
    );
  });
  it.each(['', 'invalid', randomBytes(16).toString('base64')])(
    'rejects missing or invalid search keys',
    (key) => {
      const service = new EncryptionService(
        new ConfigService({ ...settings, CONTACT_SEARCH_KEY: key }),
      );
      expect(() => service.blindIndex('phone', 'test')).toThrow();
    },
  );
  it('denies unauthorized access before decryption, including suspended staff', () => {
    const stored = row();
    const decrypt = jest.spyOn(encryption, 'decrypt');
    for (const actor of [
      other,
      { ...other, role: 'STAFF', status: 'SUSPENDED' },
      { ...owner, mustChangePassword: true },
    ])
      expect(() => contacts.readAuthorized(stored, actor)).toThrow();
    expect(decrypt).not.toHaveBeenCalled();
    expect(
      contacts.readAuthorized(stored, { ...other, role: 'STAFF' }).email,
    ).toBe('person@example.test');
  });
  it('rejects record or field swaps, tampering, partial envelopes and incorrect indexes', () => {
    const stored = row();
    for (const bad of [
      { ...stored, id: 'other' },
      { ...stored, emailAuthTag: randomBytes(16).toString('base64') },
      { ...stored, emailBlindIndex: '0'.repeat(64) },
      { ...stored, phoneIv: null },
      {
        ...stored,
        phoneCiphertext: stored.emailCiphertext,
        phoneIv: stored.emailIv,
        phoneAuthTag: stored.emailAuthTag,
      },
    ])
      expect(() => contacts.verify(bad)).toThrow(
        'Encrypted contact data is unavailable',
      );
  });
  it('clears all optional phone components and leaves omitted contacts untouched', () => {
    expect(contacts.write(owner.id, {})).toEqual({});
    const stored = row();
    Object.assign(stored, contacts.write(owner.id, { phone: '' }));
    expect(contacts.verify(stored).phone).toBeNull();
    for (const field of [
      'phoneCiphertext',
      'phoneIv',
      'phoneAuthTag',
      'phoneBlindIndex',
    ] as const)
      expect(stored[field]).toBeNull();
  });
  it.each([null, '', 'Quiet room please\nEstimated arrival: 19:30\n日本語'])(
    'round-trips optional/empty/arrival notes: %j',
    (value) => {
      const stored = {
        id: 'reservation',
        guestId: owner.id,
        ...notes.write('reservation', value),
      };
      expect(notes.read(stored, owner)).toBe(value);
      const spy = jest.spyOn(encryption, 'decrypt');
      spy.mockClear();
      expect(() => notes.read(stored, other)).toThrow();
      expect(spy).not.toHaveBeenCalled();
    },
  );
  it('rejects unauthenticated notes, incomplete values and swapped reservations', () => {
    const stored = { id: 'r', guestId: owner.id, ...notes.write('r', '') };
    expect(() =>
      notes.read({ ...stored, specialRequestsIv: null }, owner),
    ).toThrow('could not be authenticated');
    expect(() => notes.read({ ...stored, id: 'another' }, owner)).toThrow(
      'could not be authenticated',
    );
    expect(() =>
      notes.read(
        {
          ...stored,
          specialRequestsAuthTag: randomBytes(16).toString('base64'),
        },
        owner,
      ),
    ).toThrow('could not be authenticated');
  });
});
