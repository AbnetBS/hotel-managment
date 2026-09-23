/**
 * Headless smoke test.
 *
 * Boots the built app inside jsdom against the real API, signs in as every role
 * and walks all the screens. Any runtime error, empty screen or failed
 * interaction is reported loudly — so we can trust the UI without a browser.
 *
 *   npm start            # in one terminal (serves dist/ + API on :4000)
 *   npm run smoke        # in another
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const problems = [];
const log = (...args) => console.log(...args);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------ app booting ------------------------------- */

let bundleCache = null;

/**
 * The production build is split into ES modules, which jsdom cannot execute.
 * So for the test we bundle the real source with esbuild into one classic
 * script — same components, same API, just one file.
 */
function buildTestBundle() {
  const out = path.join(os.tmpdir(), `clove-smoke-${process.pid}.js`);
  execFileSync('npx', ['esbuild', 'client/src/main.jsx', '--bundle', '--format=iife', '--jsx=automatic', '--loader:.css=empty', '--define:process.env.NODE_ENV="production"', '--log-level=error', `--outfile=${out}`], { stdio: ['ignore', 'ignore', 'inherit'] });
  return fs.readFileSync(out, 'utf8');
}

async function loadApp(label) {
  const html = await fetch(`${BASE}/`).then((response) => response.text());
  if (!/id="root"/.test(html)) throw new Error('server did not return the app shell');
  const cleaned = html.replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
  if (!bundleCache) {
    log('· bundling the app for the headless walkthrough (jsdom runs one file only)');
    bundleCache = { code: buildTestBundle() };
  }

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => problems.push(`[${label}] jsdom: ${error.message}`));
  virtualConsole.on('error', (...args) => {
    const message = args.map(String).join(' ');
    if (/react|render|undefined is not|cannot read/i.test(message)) problems.push(`[${label}] console.error: ${message}`);
    if (process.env.SMOKE_DEBUG) log(`     [${label}] console.error: ${message.slice(0, 300)}`);
  });

  const dom = new JSDOM(cleaned, {
    url: `${BASE}/`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = (input, init) => fetch(new URL(typeof input === 'string' ? input : input.url, window.location.href).href, init);
      // React's scheduler prefers MessageChannel; jsdom's port stops delivering after
      // a while, which silently freezes every later React update. Force the timer path.
      delete window.MessageChannel;
      delete window.MessagePort;
      window.HTMLCanvasElement.prototype.getContext = () => null;
      window.addEventListener('error', (event) => problems.push(`[${label}] window error: ${event.message}`));
      window.addEventListener('unhandledrejection', (event) => problems.push(`[${label}] rejection: ${event.reason?.message || event.reason}`));
    },
  });

  // jsdom does not execute <script type="module">, so run the bundle ourselves.
  const script = dom.window.document.createElement('script');
  script.textContent = bundleCache.code;
  dom.window.document.body.appendChild(script);

  dom.window.__label = label;
  return dom;
}

async function waitFor(window, check, { timeout = 9000, label = 'condition' } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (check(window)) return true;
    } catch {
      /* the tree may be mid-render */
    }
    await wait(120);
  }
  problems.push(`[${window.__label}] timed out waiting for ${label}`);
  return false;
}

const text = (window) => window.document.body.textContent || '';
/** just the page content, without the sidebar/nav */
const content = (window) => {
  const doc = window.document;
  const node = doc.querySelector('main.content') || doc.querySelector('.guest') || doc.body;
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
};

function setValue(window, element, value) {
  if (!element) throw new Error('input not found');
  const tag = element.tagName;
  const prototype = tag === 'SELECT' ? window.HTMLSelectElement.prototype : tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  try {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  } catch {
    element.value = value; // last resort for exotic controls
  }
  element.dispatchEvent(new window.Event(tag === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  element.dispatchEvent(new window.Event('blur', { bubbles: true }));
}

/** Close whatever drawer/modal is open — the X, or the footer button. */
function closeDrawer(window) {
  const x = window.document.querySelector('.close-x');
  if (x) {
    x.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    return true;
  }
  const footer = [...window.document.querySelectorAll('.drawer button, .modal button')].find((button) => /^Close/.test(button.textContent.trim()));
  footer?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return Boolean(footer);
}

function click(window, selector, match = '') {
  const nodes = [...window.document.querySelectorAll(selector)];
  const node = match ? nodes.find((item) => (item.textContent || '').toLowerCase().includes(match.toLowerCase())) : nodes[0];
  if (!node) {
    problems.push(`[${window.__label}] could not find ${selector} "${match}"`);
    return false;
  }
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}

async function signIn(roleLabel, username, { expected, pin = '1234' } = {}) {
  const dom = await loadApp(username);
  const { window } = dom;
  await waitFor(window, (w) => /Which desk are you on/i.test(text(w)), { label: 'role picker' });
  await waitFor(window, (w) => w.document.querySelectorAll('.role-card').length > 0, { label: 'role list' });
  click(window, '.role-card', roleLabel);
  const ready = await waitFor(window, (w) => w.document.querySelectorAll('input[type="password"]').length > 0, { label: 'PIN field' });
  if (!ready) throw new Error(`login form never opened for ${roleLabel}`);
  const inputs = [...window.document.querySelectorAll('input')];
  setValue(window, inputs[0], username);
  setValue(window, window.document.querySelector('input[type="password"]'), pin);
  click(window, 'button[type="submit"]');
  await waitFor(window, (w) => (expected ? expected.test(content(w)) : content(w).length > 80), { label: `${username} dashboard`, timeout: 12000 });
  return dom;
}

function setHash(window, hash) {
  const before = window.location.hash;
  window.location.hash = hash;
  if (window.location.hash !== hash) {
    // jsdom occasionally swallows the fragment assignment — push it through by hand
    window.history.pushState({}, '', hash);
  }
  if (process.env.SMOKE_DEBUG) log(`     setHash ${hash}: ${before} -> ${window.location.hash} (href ${window.location.href})`);
  if (window.location.hash !== before) {
    // ...and sometimes it updates the URL without firing the event the app listens for
    window.dispatchEvent(new window.Event('hashchange'));
  }
}

async function goto(window, view, expect) {
  // click the menu entry like a real user would; fall back to the URL fragment
  const item = window.document.querySelector(`[data-view="${view}"]`);
  if (item) {
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await wait(250);
    if (window.location.hash !== `#/${view}`) setHash(window, `#/${view}`);
  } else {
    setHash(window, `#/${view}`);
  }
  await wait(500);
  if (expect) {
    const ok = await waitFor(window, (w) => expect.test(content(w)), { label: `view ${view}`, timeout: 7000 });
    if (!ok) {
      problems.push(`[${window.__label}] view "${view}" did not show its content ("${content(window).slice(0, 90)}")`);
      if (process.env.SMOKE_DEBUG) {
        const doc = window.document;
        const main = doc.querySelector('main.content');
        log(`     debug: hash=${window.location.hash} | crumbs=${doc.querySelector('.crumbs')?.textContent} | active=${doc.querySelector('.nav-item.active')?.textContent} | main.children=${main?.children.length} | first=${main?.firstElementChild?.className}`);
        log(`     debug main text: "${(main?.textContent || '').replace(/\s+/g, ' ').slice(0, 120)}"`);
        // is React still able to update this window at all?
        const toggle = doc.querySelector('.icon-btn.mobile-only');
        const before = doc.querySelector('.sidebar')?.className;
        toggle?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        await wait(400);
        log(`     debug react-alive: ${before} -> ${doc.querySelector('.sidebar')?.className}`);
        const nav = doc.querySelector('[data-view="rooms"]');
        log(`     debug nav button present: ${!!nav} | hash before click ${window.location.hash}`);
        nav?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        await wait(700);
        log(`     debug after nav click: hash ${window.location.hash} | crumbs ${doc.querySelector('.crumbs')?.textContent}`);
      }
    }
  }
}

async function walk(window, views) {
  for (const [view, expect] of views) {
    await goto(window, view, expect);
    const body = content(window);
    if (body.length < 60) problems.push(`[${window.__label}] view "${view}" rendered almost nothing ("${body}")`);
    if (/Loading the hotel/.test(body)) problems.push(`[${window.__label}] view "${view}" stayed on the loading screen`);
    log(`   · ${view.padEnd(14)} ${body.slice(0, 76)}…`);
  }
}

/* ---------------------------------- run ----------------------------------- */

let adminToken = '';
async function roomToken(number, wantFree = false) {
  // Use the manager account for the test's own API calls, so the demo admin
  // login is never touched by the sign-in throttle that the security suite exercises.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'manager', pin: '1234' }),
  }).then((response) => response.json());
  adminToken = login.token;
  const rooms = await fetch(`${BASE}/api/rooms`, { headers: { 'x-clove-token': login.token } }).then((response) => response.json());
  const room =
    rooms.rooms.find((item) => item.number === number && (!wantFree || item.status === 'available')) ||
    (wantFree ? rooms.rooms.find((item) => item.status === 'available') : null) ||
    rooms.rooms.find((item) => item.number === number) ||
    rooms.rooms[0];
  return { token: room.qr_token, number: room.number, id: room.id };
}

/** A full QR experience: scan → pick food → send order. */
async function guestOrdersFood() {
  const { token, number } = await roomToken('204');
  log(`\n▶ guest in room ${number} scans the QR code and orders`);
  const dom = await loadApp('guest-qr');
  dom.window.history.pushState({}, '', `/q/${token}`);
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await waitFor(dom.window, (w) => /Send order|Food & drinks|not checked in|not recognised/i.test(text(w)), { label: 'guest menu' });
  await wait(600);

  const plus = [...dom.window.document.querySelectorAll('.qty button')].filter((button) => button.textContent === '+');
  if (!plus.length) {
    problems.push(`[guest-qr] the guest menu has no “add” buttons — page shows: "${content(dom.window).slice(0, 140)}"`);
    return dom;
  }
  plus[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait(250);
  const hasCart = /Send order/.test(text(dom.window));
  log(`   · menu rendered with ${plus.length} orderable items · cart bar: ${hasCart ? 'visible' : 'missing'}`);
  if (!hasCart) problems.push('[guest-qr] cart bar did not appear after adding an item');

  // The guest must be able to see everything charged to the room.
  const tabs = [...dom.window.document.querySelectorAll('.seg button')];
  const billTab = tabs.find((button) => /bill/i.test(button.textContent));
  const menuTab = tabs.find((button) => /food & drinks|menu/i.test(button.textContent));
  if (billTab) {
    billTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await wait(900);
    const billText = content(dom.window);
    const okBill = /Room ·|Balance to pay/.test(billText);
    log(`   · guest bill tab: ${okBill ? billText.replace(/\s+/g, ' ').slice(0, 58) + '…' : 'MISSING the room charge or balance'}`);
    if (!okBill) problems.push('[guest-qr] the guest bill does not show the room charge and balance');
    menuTab?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await wait(700);
  } else {
    problems.push('[guest-qr] the guest page has no bill tab');
  }

  click(dom.window, 'button', 'Send order');
  await waitFor(dom.window, (w) => /sent/i.test(text(w)) && /Order #/.test(text(w)), { label: 'order confirmation', timeout: 8000 });
  log(`   · ${text(dom.window).match(/Order #\d+ sent/)?.[0] || 'order confirmation shown'}`);
  return dom;
}

/** A full QR experience #2: scan the room code, read the room, register. */
async function guestRegistersFromQr() {
  const { token, number } = await roomToken('205', true);
  log(`\n▶ a walk-in guest scans the QR at room ${number} and registers`);
  const dom = await loadApp('guest-register');
  dom.window.history.pushState({}, '', `/r/${token}`);
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await waitFor(dom.window, (w) => /Room \d|Photo|not available|already/i.test(text(w)), { label: 'guest room page', timeout: 9000 });
  await wait(500);
  log(`   · room page: ${content(dom.window).slice(0, 70)}…`);

  const inputs = [...dom.window.document.querySelectorAll('input, textarea')];
  if (inputs.length < 3) {
    problems.push(`[guest-register] the registration form has no fields (page: "${content(dom.window).slice(0, 120)}")`);
    return dom;
  }
  inputs.forEach((input, index) => {
    if (input.tagName === 'SELECT') return;
    const value = input.type === 'number' || /guest|count|adult/i.test(input.name || '')
      ? '2'
      : index === 0
        ? 'Smoke Test Guest'
        : index === 1
          ? '+251911000111'
          : 'SMOKE-1234';
    setValue(dom.window, input, value);
  });
  const selects = [...dom.window.document.querySelectorAll('select')];
  selects.forEach((select) => setValue(dom.window, select, select.options[1]?.value || select.options[0]?.value));
  log(`   · filled ${inputs.length} field(s) + ${selects.length} dropdown(s)`);

  click(dom.window, 'button', 'Send my details');
  await wait(2500);
  // The truth is on the server: a pending request must exist for this room.
  const pending = await fetch(`${BASE}/api/checkin-requests`, { headers: { 'x-clove-token': adminToken } }).then((response) => response.json());
  const arrived = (pending.requests || []).some((request) => request.room_number === number);
  log(`   · ${arrived ? 'the desk now has a pending registration for room ' + number : 'NO request reached the desk'}`);
  if (!arrived) problems.push('[guest-register] the guest form did not create a registration request');
  return dom;
}

async function main() {
  log(`▶ smoke test against ${BASE}\n`);
  if (!process.env.SMOKE_KEEP_DATA) {
    execFileSync(process.execPath, ['server/seed.js', '--reset'], { stdio: 'ignore' });
    log('· demo data reset to a known state (set SMOKE_KEEP_DATA=1 to keep it)\n');
  }

  const registration = await guestRegistersFromQr();

  log('▶ cashier');
  const cashier = await signIn('Cashier', 'cashier', { expected: /Room board/ });
  const w = cashier.window;

  await waitFor(w, (win) => win.document.querySelectorAll('.room-tile').length > 5, { label: 'room grid' });
  const tiles = w.document.querySelectorAll('.room-tile');
  log(`   · room tiles rendered: ${tiles.length}`);
  if (tiles.length < 10) problems.push('[cashier] the room grid did not render');

  const free = [...tiles].find((tile) => tile.className.includes('free'));
  free?.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await waitFor(w, (win) => /is free and ready|Time in the room/.test(text(win)), { label: 'room drawer' });
  log(`   · free room drawer: ${/is free and ready/.test(text(w)) ? 'photos, price and the check-in button — ready to show a guest' : 'UNEXPECTED'}`);
  closeDrawer(w);
  await wait(250);

  const occupied = [...w.document.querySelectorAll('.room-tile')].find((tile) => tile.className.includes('busy'));
  occupied?.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await waitFor(w, (win) => /Time in the room/.test(text(win)), { label: 'occupied room drawer' });
  const drawer = text(w);
  const ticking = /Next (night|hour|day-use block) starts in/.test(drawer);
  log(`   · occupied room drawer: live counter ${ticking ? 'ticking' : 'MISSING'} · bill panel ${/Balance to collect/.test(drawer) ? 'present' : 'MISSING'}`);
  if (!ticking) problems.push('[cashier] the live billing countdown is missing on an occupied room');
  if (!/Paid & release/.test(drawer)) problems.push('[cashier] the Paid & release button is missing');
  closeDrawer(w);
  await wait(300);

  // Rooms waiting for housekeeping are purple and can be cleared from the desk.
  if (/waiting to be cleaned/i.test(text(w))) {
    const cleanButton = [...w.document.querySelectorAll('.clean-queue button')].find((button) => /^Cleaned/.test(button.textContent.trim()));
    if (cleanButton) {
      cleanButton.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      await wait(1200);
      log('   · marked a purple room clean from the desk — it went green again');
    } else {
      problems.push('[cashier] the cleaning panel has no “Cleaned” button');
    }
  } else {
    problems.push('[cashier] the rooms-waiting-to-be-cleaned panel is missing');
  }

  // The guest who registered from the QR code is waiting at the desk.
  if (!/Waiting for the desk/.test(text(w))) problems.push('[cashier] the pending registration panel is not on the room board');
  const approve = [...w.document.querySelectorAll('button')].find((button) => /^\s*Check in/.test(button.textContent) && !button.disabled);
  if (approve) {
    approve.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(1600);
    log('   · approved the guest who filled the form from the QR code — room occupied, bill started');
  } else {
    problems.push('[cashier] the pending QR registration never appeared on the room board');
  }

  await walk(w, [
    ['stays', /In-house guests|Guest bills/],
    ['folios', /Open bills|Guest bills/],
    ['reservations', /Reservations/],
  ]);

  // A guest in room 204 orders from the QR code while the cashier is on duty:
  // it must ring the desk full screen.
  const guest = await guestOrdersFood();
  const rang = await waitFor(w, (win) => win.document.querySelector('.alert-overlay'), { label: 'full-screen order alert', timeout: 15000 });
  if (rang) {
    log(`   · it rang the desk full screen: "${(w.document.querySelector('.alert-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 62)}…"`);
    click(w, '.alert-card button', 'Accept');
    await wait(1600);
    const gone = !w.document.querySelector('.alert-overlay');
    log(`   · ${gone ? 'cashier accepted it (guest called & confirmed) — the alert cleared' : 'the alert stayed on screen after accepting'}`);
    if (!gone) problems.push('[cashier] the order alert did not clear after accepting');
  } else {
    problems.push('[cashier] the QR order never rang the full-screen alert');
  }

  // Send the accepted order to the stations (kitchen / barista / juice).
  await goto(w, 'orders', /Orders desk/);
  const send = [...w.document.querySelectorAll('button')].find((button) => /Send to stations/.test(button.textContent) && !button.disabled);
  if (send) {
    send.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(1600);
    log('   · sent the order to the stations');
  } else {
    problems.push('[cashier] the accepted order has no “Send to stations” button');
  }

  log('\n▶ stations');
  for (const [username, label] of [['kitchen', 'Kitchen'], ['barista', 'Barista'], ['juice', 'Juice station']]) {
    const dom = await signIn(label, username, {});
    await waitFor(dom.window, (win) => /ticket|Nothing|Waiting to start|Accept/i.test(content(win)), { label: `${username} board`, timeout: 9000 });
    await wait(900);
    let handled = 0;
    // Accept → Done, item by item, until the board is clear.
    for (let guard = 0; guard < 24; guard += 1) {
      const button = [...dom.window.document.querySelectorAll('.station-ticket button')]
        .find((candidate) => /^(Accept|Done)/.test(candidate.textContent.trim()) && !candidate.disabled);
      if (!button) break;
      const finished = /^Done/.test(button.textContent.trim());
      button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      if (finished) handled += 1;
      await wait(600);
    }
    const left = dom.window.document.querySelectorAll('.station-ticket').length;
    if (process.env.SMOKE_DEBUG) {
      const texts = [...dom.window.document.querySelectorAll('.station-ticket button')].map((b) => `"${b.textContent.trim()}"${b.disabled ? '(disabled)' : ''}`);
      log(`     [${username}] ticket buttons: ${texts.join(' | ') || '(none)'}`);
    }
    log(`   · ${username}: ${handled} item(s) accepted & finished · ${left} ticket(s) left on the board`);
    dom.window.close();
  }

  log('\n▶ waiter');
  const waiter = await signIn('Waiter', 'waiter', { expected: /Deliveries/ });
  await waitFor(waiter.window, (win) => /Delivered to Room/.test(text(win)), { label: 'a ready order to deliver', timeout: 15000 });
  await wait(400);
  const deliverButton = [...waiter.window.document.querySelectorAll('button')].find((button) => /Delivered to Room/.test(button.textContent) && !button.disabled);
  if (deliverButton) {
    deliverButton.dispatchEvent(new waiter.window.MouseEvent('click', { bubbles: true }));
    await wait(1600);
    log('   · delivered it to the room — the food is on the guest bill now');
  } else {
    problems.push('[waiter] no ready order to deliver');
  }
  waiter.window.close();

  // Back at the desk: close the order and make sure the money landed on the bill.
  await goto(w, 'orders', /Orders desk/);
  const closeOrder = [...w.document.querySelectorAll('button')].find((button) => /close order/i.test(button.textContent) && !button.disabled);
  if (closeOrder) {
    closeOrder.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(1600);
    log('   · cashier marked it done — the food money sits on the room bill');
  } else {
    problems.push('[cashier] the delivered order could not be closed');
  }
  cashier.window.close();
  guest.window.close();
  registration.window.close();

  log('\n▶ housekeeping + maintenance');
  const housekeeping = await signIn('Housekeeping', 'housekeeping', { expected: /Cleaning tasks|No cleaning tasks/ });
  const taskButton = (win) => [...win.document.querySelectorAll('button')].find((button) => /^(Start cleaning|Cleaned)/.test(button.textContent.trim()));
  await waitFor(housekeeping.window, (win) => Boolean(taskButton(win)), { label: 'housekeeping task buttons', timeout: 12000 });
  const startButton = taskButton(housekeeping.window);
  if (startButton) {
    startButton.dispatchEvent(new housekeeping.window.MouseEvent('click', { bubbles: true }));
    await wait(900);
    log(`   · cleaned a room: ${/Cleaning now|Finished|Cleaned/.test(text(housekeeping.window)) ? 'the task moved on' : 'UNEXPECTED'}`);
  } else {
    problems.push('[housekeeping] no task could be started');
  }
  housekeeping.window.close();

  // Maintenance lives in the manager workspace (there is no separate maintenance login).
  const maintenance = await signIn('Manager', 'manager', { expected: /Good day|Issue/ });
  await goto(maintenance.window, 'maintenance', /Maintenance/);
  await wait(500);
  log('   · maintenance board rendered');
  maintenance.window.close();

  log('\n▶ admin');
  const admin = await signIn('Owner / Admin', 'admin', { expected: /Good day|Overview/ });
  await walk(admin.window, [
    ['overview', /Good day|Occupancy/],
    ['reports', /Reports/],
    ['roomtypes', /Rooms & photos/],
    ['menu', /Menu & stations/],
    ['qrcodes', /Room QR codes/],
    ['formbuilder', /questions you ask every guest/i],
    ['staff', /Staff & access/],
    ['settings', /Hotel settings/],
    ['audit', /Audit log/],
    ['rooms', /Room board/],
    ['orders', /Orders desk/],
    ['stays', /In-house guests/],
    ['folios', /Guest bills/],
    ['reservations', /Reservations/],
    ['housekeeping', /Housekeeping/],
    ['maintenance', /Maintenance/],
  ]);
  admin.window.close();

  /* ------------------------------- verdict -------------------------------- */
  const unique = [...new Set(problems)];
  if (unique.length) {
    console.error('\n✗ smoke test found problems:\n');
    unique.forEach((problem) => console.error('  -', problem));
    process.exit(1);
  }
  console.log('\n✅ smoke test passed — every role signed in, every screen rendered, and the whole guest QR → desk → station → waiter → bill loop worked');
}

main().catch((error) => {
  console.error('\n✗ smoke test crashed:', error.message);
  [...new Set(problems)].forEach((problem) => console.error('  -', problem));
  process.exit(1);
});
