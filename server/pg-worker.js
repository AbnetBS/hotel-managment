/**
 * PostgreSQL worker — the only place that talks to the `pg` driver.
 *
 * The rest of the server is written with a small synchronous database API
 * (prepare/get/all/run). PostgreSQL's Node driver is asynchronous, so this
 * worker owns one long-lived connection and answers queries over a
 * MessagePort; the main thread blocks with Atomics.wait while it works.
 * One connection also keeps BEGIN/COMMIT ordering correct.
 */
import { parentPort, workerData } from 'node:worker_threads';
import pg from 'pg';

const { connectionString } = workerData;

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require/.test(String(connectionString)) ? { rejectUnauthorized: false } : undefined,
});

let connected = null;
function ensureConnected() {
  if (!connected) {
    connected = client.connect().catch((error) => {
      connected = null;
      throw error;
    });
  }
  return connected;
}

// Numbers come back as strings for bigint/numeric — the app expects numbers.
const NUMERIC_OIDS = new Set([20, 21, 23, 700, 701, 1700]);
function shapeRow(row, fields) {
  if (!fields) return row;
  for (const field of fields) {
    if (NUMERIC_OIDS.has(field.dataTypeID) && typeof row[field.name] === 'string') {
      const value = Number(row[field.name]);
      if (Number.isFinite(value)) row[field.name] = value;
    }
  }
  return row;
}

async function runRequest({ sql, params }) {
  await ensureConnected();
  const result = params && params.length
    ? await client.query({ text: sql, values: params })
    : await client.query(sql);
  const fields = (result.fields || []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID }));
  return {
    rows: (result.rows || []).map((row) => shapeRow(row, result.fields)),
    rowCount: result.rowCount ?? 0,
    fields,
  };
}

parentPort.on('message', ({ port, sab }) => {
  // Requests are serialized: the synchronous caller only ever has one in flight,
  // but a promise chain guarantees order even if that ever changes.
  let queue = Promise.resolve();

  port.on('message', (request) => {
    queue = queue
      .then(async () => {
        try {
          const result = await runRequest(request);
          port.postMessage({ seq: request.seq, ok: true, ...result });
        } catch (error) {
          port.postMessage({ seq: request.seq, ok: false, error: error?.message || String(error) });
        }
        // Wake the caller only after the reply is enqueued on the port.
        Atomics.store(sab, 0, 1);
        Atomics.notify(sab, 0);
      })
      .catch(() => {});
  });

  port.postMessage({ seq: 0, ok: true, ready: true });
  Atomics.store(sab, 0, 1);
  Atomics.notify(sab, 0);
});
