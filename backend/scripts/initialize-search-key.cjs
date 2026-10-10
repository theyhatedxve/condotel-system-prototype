// Creates only a missing search key in an existing local .env. Never prints key material.
const fs = require('node:fs');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
try {
  const path = '.env';
  const source = fs.readFileSync(path, 'utf8');
  const config = dotenv.parse(source);
  if (config.CONTACT_SEARCH_KEY) {
    process.stdout.write('Existing contact search key preserved.\n');
  } else {
    const entry =
      'CONTACT_SEARCH_KEY=' + crypto.randomBytes(32).toString('base64');
    const result = /^\s*CONTACT_SEARCH_KEY\s*=.*$/m.test(source)
      ? source.replace(/^\s*CONTACT_SEARCH_KEY\s*=.*$/m, entry)
      : source + '\n' + entry + '\n';
    fs.writeFileSync(path, result, { mode: 0o600 });
    process.stdout.write(
      'Contact search key initialized. Back up backend secrets securely before migration.\n',
    );
  }
} catch {
  process.stderr.write(
    'Search-key setup failed. An existing writable backend .env is required.\n',
  );
  process.exitCode = 1;
}
