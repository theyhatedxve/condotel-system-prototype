import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ContactProtectionService } from './contact-protection.service';
import { EncryptionService } from './encryption.service';
import { PrivacyReadinessService } from './privacy-readiness.service';

describe('Privacy startup diagnostics', () => {
  it('explains missing key setup without exposing secrets or querying accounts', async () => {
    const key = randomBytes(32).toString('base64');
    const query = jest.fn();
    const contacts = new ContactProtectionService(
      new EncryptionService(
        new ConfigService({ AES_MASTER_KEY: key, CONTACT_SEARCH_KEY: '' }),
      ),
    );
    const readiness = new PrivacyReadinessService(
      { $queryRaw: query } as unknown as PrismaService,
      contacts,
    );
    const failure = await readiness
      .onApplicationBootstrap()
      .catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('CONTACT_SEARCH_KEY');
    expect((failure as Error).message).toContain('Preserve existing keys');
    expect((failure as Error).message).not.toContain(key);
    expect(query).not.toHaveBeenCalled();
  });
});
