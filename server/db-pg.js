/**
 * PostgreSQL engine behind the synchronous db facade.
 *
 * translate() rewrites SQLite-flavoured SQL (the schema and queries in this
 * project speak SQLite) into PostgreSQL: `?` / `@name` parameters become `$1..$n`,
 * `REAL` columns become `DOUBLE PRECISION` (money must never be float4),
 * PRAGMAs are answered or ignored. querySync() runs one statement at a time on
 * a worker thread and blocks this thread until the rows are back.
 */
import { Worker, MessageChannel, receiveMessageOnPort } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WAIT_TIMEOUT_MS = 30_000;

/* ------------------------------ SQL rewrite ------------------------------ */

/** Split out quoted strings so parameter rewriting never touches literals. */
function maskLiterals(sql) {
  const parts = [];
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" && sql[j + 1] === "'" ? 2 : 1;
      j = Math.min(j + 1, sql.length);
      parts.push(sql.slice(i, j));
      out += `\u0000${parts.length - 1}\u0000`;
      i = j;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j += 1;
      j = Math.min(j + 1, sql.length);
      parts.push(sql.slice(i, j));
      out += `\u0000${parts.length - 1}\u0000`;
      i = j;
    } else {
      out += ch;
      i += 1;
    }
  }
  return { masked: out, parts };
}

function unmask(sql, parts) {
  return sql.replace(/\u0000(\d+)\u0000/g, (_, n) => parts[Number(n)]);
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

const TABLE_INFO = /^PRAGMA\s+table_info\s*\(\s*["']?([\w-]+)["']?\s*\)/i;

/**
 * Rewrite one statement for PostgreSQL.
 * Returns { text, values } or { skip: true } for PRAGMAs PostgreSQL does not need.
 */
export function translate(sql, params = []) {
  const trimmed = String(sql).trim();

  const info = trimmed.match(TABLE_INFO);
  if (info) {
    return {
      text: `SELECT (ordinal_position - 1) AS cid, column_name AS name, data_type AS type,
                    (CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END) AS notnull,
                    column_default AS dflt_value, 0 AS pk
             FROM information_schema.columns
             WHERE table_name = $1 AND table_schema = current_schema()
             ORDER BY ordinal_position`,
      values: [info[1]],
    };
  }
  if (/^PRAGMA/i.test(trimmed)) return { skip: true };

  const { masked, parts } = maskLiterals(trimmed);
  const values = [];
  const indexByName = new Map();
  const named = params.length === 1 && params[0] !== null && typeof params[0] === 'object'
    && !Array.isArray(params[0]) && !(params[0] instanceof Date) && !Buffer.isBuffer(params[0]);

  let rewritten = masked;

  if (named) {
    const bag = params[0];
    rewritten = rewritten.replace(/([@:$])([A-Za-z_][\w]*)/g, (match, _sig, name) => {
      if (!Object.prototype.hasOwnProperty.call(bag, name) && !Object.prototype.hasOwnProperty.call(bag, match)) return match;
      if (!indexByName.has(name)) {
        values.push(normalizeValue(bag[name] !== undefined ? bag[name] : bag[match]));
        indexByName.set(name, values.length);
      }
      return `$${indexByName.get(name)}`;
    });
  } else {
    let n = 0;
    rewritten = rewritten.replace(/\?/g, () => {
      values.push(normalizeValue(params[n]));
      n += 1;
      return `$${n}`;
    });
    // A named bag can still arrive as literal `@name` with a plain array (never
    // happens today) — leave that SQL untouched and pass values straight through.
    if (n === 0 && params.length) params.forEach((p) => values.push(normalizeValue(p)));
  }

  // Money and rates must not land in PostgreSQL's float4 `REAL`.
  rewritten = rewritten.replace(/\bREAL\b/g, 'DOUBLE PRECISION');

  return { text: unmask(rewritten, parts), values };
}

/* --------------------------- sync query bridge --------------------------- */

export function createPgEngine(connectionString) {
  const worker = new Worker(path.join(here, 'pg-worker.js'), {
    workerData: { connectionString },
  });
  worker.unref?.();

  const { port1, port2 } = new MessageChannel();
  const sab = new Int32Array(new SharedArrayBuffer(4));
  const sleepSab = new Int32Array(new SharedArrayBuffer(4));
  let seq = 0;

  // Hand the worker its reply channel, then wait for its ready ping.
  worker.postMessage({ port: port2, sab }, [port2]);
  Atomics.store(sab, 0, 0);
  waitReply();

  function waitReply(timeoutMs = WAIT_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    // Sleep-loop: the wake can land a hair before the message is visible.
    for (;;) {
      const message = receiveMessageOnPort(port1);
      if (message) return message.message;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('Database query timed out.');
      if (Atomics.load(sab, 0) === 0) {
        Atomics.wait(sab, 0, 0, Math.min(left, 1000));
      } else {
        Atomics.wait(sleepSab, 0, 0, 1);
      }
    }
  }

  function call(request) {
    seq += 1;
    Atomics.store(sab, 0, 0);
    port1.postMessage({ ...request, seq });
    const reply = waitReply();
    if (!reply?.ok) throw new Error(reply?.error || 'Database query failed.');
    return reply;
  }

  function prepare(sql) {
    return {
      get(...params) {
        const { text, values, skip } = translate(sql, params);
        if (skip) return undefined;
        return call({ sql: text, params: values }).rows[0];
      },
      all(...params) {
        const { text, values, skip } = translate(sql, params);
        if (skip) return [];
        return call({ sql: text, params: values }).rows;
      },
      run(...params) {
        const { text, values, skip } = translate(sql, params);
        if (skip) return { changes: 0, lastInsertRowid: 0 };
        const reply = call({ sql: text, params: values });
        return { changes: reply.rowCount, lastInsertRowid: 0 };
      },
    };
  }

  function exec(sql) {
    const statements = String(sql)
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s && !/^PRAGMA/i.test(s));
    for (const statement of statements) {
      const { text, skip } = translate(statement, []);
      if (!skip) call({ sql: text, params: [] });
    }
  }

  return {
    driver: 'pg',
    prepare,
    exec,
    // One-shot maintenance helpers used by the seed/reset path.
    wipeTable(table) {
      call({ sql: `TRUNCATE TABLE ${table} CASCADE`, params: [] });
    },
    foreignKeys() {
      /* TRUNCATE CASCADE handles this on PostgreSQL */
    },
    close() {
      try {
        port1.close();
        worker.terminate();
      } catch {
        /* already gone */
      }
    },
  };
}
