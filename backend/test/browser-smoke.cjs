/* Optional Windows/Chromium smoke test. Uses only disposable data and random secrets. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const Database = require('better-sqlite3');
const { ConfigService } = require('@nestjs/config');
const { EncryptionService } = require('../dist/security/encryption.service');
const {
  ContactProtectionService,
} = require('../dist/security/contact-protection.service');
const {
  ReservationNotesService,
} = require('../dist/security/reservation-notes.service');
const { migratePrivacy } = require('../dist/security/privacy-migration');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) =>
  nativeFetch(url, { signal: AbortSignal.timeout(5000), ...options });
async function waitFor(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await check()) return;
    } catch {}
    await pause(150);
  }
  throw new Error('Browser smoke timed out: ' + label);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function main() {
  const browserPath =
    process.env.BROWSER_EXECUTABLE ||
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  if (!fs.existsSync(browserPath))
    throw new Error('Set BROWSER_EXECUTABLE to an installed Chromium browser.');
  const root = fs.realpathSync(process.cwd());
  const directory = fs.mkdtempSync(path.join(root, '.test-data-browser-'));
  const databasePath = path.join(directory, 'test.db');
  fs.writeFileSync(databasePath, '', { flag: 'wx' });
  const [apiPort, webPort, debugPort] = await Promise.all([
    freePort(),
    freePort(),
    freePort(),
  ]);
  const origin = 'http://127.0.0.1:' + webPort;
  const api = 'http://127.0.0.1:' + apiPort + '/api';
  const settings = {
    ...process.env,
    DATABASE_URL: 'file:' + databasePath.replaceAll('\\', '/'),
    PORT: String(apiPort),
    FRONTEND_URL: origin,
    AES_MASTER_KEY: randomBytes(32).toString('base64'),
    CONTACT_SEARCH_KEY: randomBytes(32).toString('base64'),
    JWT_SECRET: randomBytes(32).toString('base64'),
    PAYMONGO_SECRET_KEY: '',
    PAYMONGO_WEBHOOK_SECRET: '',
    VITE_API_BASE_URL: api,
  };
  const children = [];
  let ws;
  const report = (message) => process.stdout.write(message + '\n');
  const guard = setTimeout(() => {
    for (const child of children) child.kill();
    ws?.close();
  }, 90000);
  try {
    execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        'prisma7.config.ts',
      ],
      { env: settings, stdio: 'pipe' },
    );
    const encryption = new EncryptionService(new ConfigService(settings));
    let db = new Database(databasePath);
    migratePrivacy(
      db,
      new ContactProtectionService(encryption),
      new ReservationNotesService(encryption),
      'finalize',
    );
    db.close();
    report('Disposable database finalized.');
    children.push(
      spawn(process.execPath, ['dist/main.js'], {
        env: settings,
        windowsHide: true,
        stdio: 'ignore',
      }),
    );
    children.push(
      spawn(
        process.execPath,
        [
          'node_modules/vite/bin/vite.js',
          '--host',
          '127.0.0.1',
          '--port',
          String(webPort),
          '--strictPort',
        ],
        {
          cwd: path.resolve('../frontend'),
          env: settings,
          windowsHide: true,
          stdio: 'ignore',
        },
      ),
    );
    await waitFor(
      async () => (await fetch(api + '/auth/me')).status === 401,
      'API startup',
    );
    await waitFor(async () => (await fetch(origin)).ok, 'frontend startup');
    report('Temporary API and frontend ready.');
    const password = randomBytes(24).toString('base64');
    const account = await fetch(api + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ui.owner@example.test',
        username: 'ui-owner',
        firstName: 'Browser',
        lastName: 'Owner',
        password,
      }),
    });
    assert.equal(account.status, 201);
    const owner = (await account.json()).user;
    db = new Database(databasePath);
    db.prepare("UPDATE User SET role='ADMIN' WHERE id=?").run(owner.id);
    db.close();
    report('Synthetic account ready. Starting Chromium.');
    children.push(
      spawn(
        browserPath,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--remote-debugging-port=' + debugPort,
          '--user-data-dir=' + path.join(directory, 'browser'),
          'about:blank',
        ],
        { windowsHide: true, stdio: 'ignore' },
      ),
    );
    await waitFor(
      async () =>
        (await fetch('http://127.0.0.1:' + debugPort + '/json/version')).ok,
      'browser startup',
    );
    const target = await (
      await fetch(
        'http://127.0.0.1:' +
          debugPort +
          '/json/new?' +
          encodeURIComponent(origin + '/login'),
        { method: 'PUT' },
      )
    ).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    let serial = 0;
    const pending = new Map();
    const exceptions = [];
    ws.addEventListener('message', (event) => {
      const response = JSON.parse(event.data);
      if (response.method === 'Runtime.exceptionThrown')
        exceptions.push(response.params.exceptionDetails.text);
      if (response.id && pending.has(response.id)) {
        const { resolve, reject } = pending.get(response.id);
        pending.delete(response.id);
        if (response.error) reject(new Error(response.error.message));
        else resolve(response.result);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++serial;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Browser protocol timeout: ' + method));
        }, 10000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error('Browser script failed.');
      return result.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    const contains = (text) =>
      evaluate(
        'document.body.innerText.includes(' + JSON.stringify(text) + ')',
      );
    const click = (text) =>
      evaluate(
        `(() => { const button=[...document.querySelectorAll('button')].find(el => el.textContent.trim()===${JSON.stringify(text)}); if(!button) throw new Error('Button missing'); button.click(); })()`,
      );
    const fill = (selector, value) =>
      evaluate(
        `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Input missing'); Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
      );
    const field = (label, value) =>
      evaluate(
        `(() => { const label=[...document.querySelectorAll('dialog label')].find(el=>el.querySelector('span')?.textContent===${JSON.stringify(label)}); const el=label.querySelector('input,textarea,select'); Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
      );
    const submitDialog = () =>
      evaluate("document.querySelector('dialog form').requestSubmit()");
    const navigate = async (route) => {
      await send('Page.navigate', { url: origin + route });
      await waitFor(() => evaluate("document.readyState==='complete'"), route);
    };
    await waitFor(
      () =>
        evaluate("!!document.querySelector('input[autocomplete=username]')"),
      'login',
    );
    await fill('input[autocomplete=username]', 'ui-owner');
    await fill('input[autocomplete=current-password]', password);
    await click('Sign In');
    await waitFor(() => contains('Welcome, Browser'), 'login redirect');
    report('Browser login passed.');
    assert.equal(await contains('Device Management'), false);
    await navigate('/admin/rooms');
    await waitFor(() => contains('Add Room'), 'rooms');
    await click('Add Room');
    await field('Room number', '101');
    await field('Room type', 'Suite');
    await submitDialog();
    await waitFor(() => contains('Room 101'), 'room creation');
    await navigate('/admin/reservations');
    await waitFor(() => contains('New Reservation'), 'reservations');
    await click('New Reservation');
    await waitFor(
      () =>
        evaluate("document.querySelector('dialog select')?.options.length>1"),
      'room options',
    );
    const room = await evaluate(
      "document.querySelector('dialog select').options[1].value",
    );
    await field('Room', room);
    await field(
      'Check-in',
      new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    );
    await field(
      'Check-out',
      new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
    );
    await field('Special requests (optional)', 'Quiet room from browser');
    await field('Estimated arrival (optional)', '20:30');
    await submitDialog();
    await waitFor(
      () =>
        evaluate(
          "!document.querySelector('dialog') && document.body.innerText.includes('PENDING')",
        ),
      'booking submission',
    );
    await click('Notes');
    await waitFor(() => contains('Estimated arrival: 20:30'), 'arrival note');
    await field('Special requests (optional)', 'Updated browser request');
    await submitDialog();
    await waitFor(
      () => evaluate("!document.querySelector('dialog')"),
      'notes update',
    );
    await navigate('/admin/profile');
    await waitFor(
      () => evaluate("!!document.querySelector('input[type=email]')"),
      'profile',
    );
    await fill('input[type=email]', 'ui.changed@example.test');
    await click('Save');
    await waitFor(() => contains('Profile updated.'), 'profile save');
    await navigate('/admin/guests');
    await waitFor(() => contains('Add Guest'), 'guests');
    await click('Add Guest');
    await field('First name', 'Browser');
    await field('Last name', 'Guest');
    await field('Email', 'ui.guest@example.test');
    await field('Password', password);
    await submitDialog();
    await waitFor(
      () =>
        evaluate(
          "!document.querySelector('dialog') && document.body.innerText.includes('ui.guest@example.test')",
        ),
      'guest creation',
    );
    await navigate('/admin/users');
    await waitFor(() => contains('Add User'), 'users');
    await fill('input[aria-label="Search guests"]', 'ui.changed@example.test');
    await click('Search');
    await waitFor(
      () =>
        evaluate(
          "document.querySelectorAll('tbody tr').length===1 && document.querySelector('tbody').innerText.includes('ui.changed@example.test')",
        ),
      'exact search',
    );
    await evaluate(
      "document.querySelector('button[aria-label=Notifications]').click()",
    );
    await waitFor(
      () => contains('Your reservation was created.'),
      'notifications',
    );
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await send('Page.navigate', { url: origin + '/admin/reservations' });
    await waitFor(() => contains('New Reservation'), 'mobile reservations');
    fs.mkdirSync(path.join(root, '.test-artifacts'), { recursive: true });
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(root, '.test-artifacts/privacy-mobile.png'),
      Buffer.from(screenshot.data, 'base64'),
    );
    assert.equal(exceptions.length, 0, 'Browser runtime errors');
    db = new Database(databasePath);
    assert.equal(
      db
        .prepare(
          'SELECT count(*) AS count FROM User WHERE email IS NOT NULL OR phone IS NOT NULL',
        )
        .get().count,
      0,
    );
    assert.equal(
      db
        .prepare(
          'SELECT count(*) AS count FROM Reservation WHERE specialRequests IS NOT NULL',
        )
        .get().count,
      0,
    );
    const notes = new ReservationNotesService(encryption).verify(
      db.prepare('SELECT * FROM Reservation').get(),
    );
    assert.equal(notes, 'Updated browser request');
    db.close();
    process.stdout.write(
      'Browser smoke passed: login, device removal, room/booking forms, encrypted notes/arrival, profile, guest creation, exact user search, notifications, mobile rendering.\n',
    );
    await send('Browser.close').catch(() => {});
  } finally {
    clearTimeout(guard);
    ws?.close();
    for (const child of children.reverse())
      if (child.exitCode === null) child.kill();
    await pause(1500);
    const target = fs.realpathSync(directory);
    if (
      !target.startsWith(root + path.sep) ||
      !path.basename(target).startsWith('.test-data-browser-')
    ) {
      process.stderr.write('Refusing unsafe browser cleanup path.\n');
      process.exitCode = 1;
    } else {
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  }
}
void main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
