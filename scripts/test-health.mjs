/**
 * Build stamp freshness.  Run against a live server:  npm run test:health
 *
 * /api/health must read dist/build-id.txt on every call.  It used to be cached
 * at boot, so a rebuild + reload still reported the old version until the
 * process restarted — which read as "the fix never deployed".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distStamp = path.join(here, '..', 'dist', 'build-id.txt');
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
let pass = 0, fail = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); ok ? pass++ : fail++; };
const health = async () => (await fetch(`${base}/api/health`)).json();

const first = await health();
check('/api/health reports a build version', typeof first.version === 'string' && first.version.length > 0, first.version);

// Simulate a rebuild by rewriting the stamp — no server restart.
const original = fs.existsSync(distStamp) ? fs.readFileSync(distStamp, 'utf8') : null;
const marker = `regression-${Date.now()}`;
try {
  fs.mkdirSync(path.dirname(distStamp), { recursive: true });
  fs.writeFileSync(distStamp, marker);
  const second = await health();
  check('the new build shows up without restarting the server', second.version === marker, `${first.version} → ${second.version}`);
} finally {
  if (original !== null) fs.writeFileSync(distStamp, original);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
