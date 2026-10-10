import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, sep } from 'node:path';
import Database from 'better-sqlite3';

describe('Offline privacy commands on a disposable database', () => {
  let directory: string;
  let databasePath: string;
  const aes = randomBytes(32).toString('base64');
  const search = randomBytes(32).toString('base64');
  const nextAes = randomBytes(32).toString('base64');
  const nextSearch = randomBytes(32).toString('base64');
  const env = {
    ...process.env,
    AES_MASTER_KEY: aes,
    CONTACT_SEARCH_KEY: search,
    NEXT_AES_MASTER_KEY: nextAes,
    NEXT_CONTACT_SEARCH_KEY: nextSearch,
  };
  function command(
    script: string,
    args: string[],
    input?: string,
    override = {},
  ) {
    return execFileSync(
      process.execPath,
      ['node_modules/ts-node/dist/bin.js', script, ...args],
      {
        cwd: process.cwd(),
        env: { ...env, ...override },
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  }
  beforeAll(() => {
    directory = mkdtempSync(join(process.cwd(), '.test-data-cli-'));
    databasePath = join(directory, 'test.db');
    writeFileSync(databasePath, '', { flag: 'wx' });
    execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        'prisma7.config.ts',
      ],
      {
        env: {
          ...env,
          DATABASE_URL: 'file:' + databasePath.replaceAll('\\', '/'),
        },
        stdio: 'pipe',
      },
    );
  }, 30000);
  afterAll(() => {
    if (!directory) return;
    const target = realpathSync(directory),
      root = realpathSync(process.cwd());
    if (!target.startsWith(root + sep) || !target.includes('.test-data-cli-'))
      throw new Error('Unsafe test cleanup path.');
    rmSync(target, { recursive: true, force: true });
  });
  it('runs migration/provisioning/rotation commands without emitting contact values or keys', () => {
    writeFileSync(
      join(directory, '.env'),
      'AES_MASTER_KEY=' +
        aes +
        '\nJWT_SECRET=existing-test-value\nCONTACT_SEARCH_KEY=\n',
    );
    const initializer = join(
      process.cwd(),
      'scripts',
      'initialize-search-key.cjs',
    );
    const initialized = execFileSync(process.execPath, [initializer], {
      cwd: directory,
      encoding: 'utf8',
    });
    expect(initialized).not.toContain(aes);
    const configuration = readFileSync(join(directory, '.env'), 'utf8');
    expect(configuration).toContain('AES_MASTER_KEY=' + aes);
    expect(configuration).toContain('JWT_SECRET=existing-test-value');
    expect(configuration).toMatch(/CONTACT_SEARCH_KEY=[a-zA-Z0-9+/]{43}=/);
    execFileSync(process.execPath, [initializer], {
      cwd: directory,
      stdio: 'pipe',
    });
    expect(readFileSync(join(directory, '.env'), 'utf8')).toBe(configuration);
    const legacy = new Database(databasePath);
    legacy
      .prepare(
        'INSERT INTO User (id,email,phone,firstName,lastName,passwordHash,updatedAt) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        'legacy',
        'legacy.cli@example.test',
        '+63900777777',
        'Legacy',
        'Account',
        'preserved-legacy-hash',
        Date.now(),
      );
    legacy.close();
    for (const phase of ['audit', 'backfill', 'verify', 'finalize']) {
      const output = command('scripts/migrate-privacy.ts', [
        phase,
        databasePath,
        '--offline-backup-confirmed',
      ]);
      expect(output).toContain('"phase":"' + phase + '"');
      expect(output).not.toContain(aes);
      expect(output).not.toContain(search);
    }
    expect(
      readFileSync(databasePath).includes(
        Buffer.from('legacy.cli@example.test'),
      ),
    ).toBe(false);
    expect(
      readFileSync(databasePath).includes(Buffer.from('+63900777777')),
    ).toBe(false);
    const account = {
      email: 'CLI@EXAMPLE.TEST',
      phone: ' 123 ',
      firstName: 'Seed',
      lastName: 'Account',
      role: 'ADMIN',
      password: randomBytes(24).toString('base64'),
    };
    const output = command(
      'scripts/create-account.ts',
      [databasePath, '--operator-provisioning'],
      JSON.stringify(account),
    );
    expect(output).toContain('Account created:');
    expect(output).not.toContain(account.email);
    expect(output).not.toContain(account.password);
    const db = new Database(databasePath);
    const stored = db
      .prepare("SELECT * FROM User WHERE firstName = 'Seed'")
      .get() as Record<string, string | null>;
    expect(stored.email).toBeNull();
    expect(stored.phone).toBeNull();
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    db.close();
    expect(() =>
      command(
        'scripts/create-account.ts',
        [databasePath, '--operator-provisioning'],
        JSON.stringify(account),
      ),
    ).toThrow();
    const rotation = command('scripts/rotate-privacy.ts', [
      databasePath,
      '--offline-backup-confirmed',
    ]);
    expect(rotation).toContain('Rotation verified');
    expect(rotation).not.toContain(nextAes);
    expect(() =>
      command('scripts/migrate-privacy.ts', ['verify', databasePath]),
    ).toThrow();
    expect(
      command(
        'scripts/migrate-privacy.ts',
        ['verify', databasePath],
        undefined,
        { AES_MASTER_KEY: nextAes, CONTACT_SEARCH_KEY: nextSearch },
      ),
    ).toContain('"users":2');
  }, 120000);
});
