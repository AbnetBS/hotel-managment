/**
 * Currency for a hotel that takes dollars, euros and pounds.
 *
 * The rule a hotel actually works by: the guest's bill is quoted in THEIR money,
 * and the rate that was agreed at check-in is the rate used for the whole stay.
 * Everything is stored in ETB underneath (that is what the books are in), with
 * the foreign amount and the rate kept next to it for the receipt.
 *
 * Rates come from, in this order:
 *   1. the National Bank of Ethiopia (the official source) — refreshed on demand
 *      or automatically once a day;
 *   2. rates the manager typed in, when the internet is down;
 *   3. the last rates we successfully fetched (cached).
 * Whatever is used, the bill always says which one it was.
 */
import { getSetting, setSetting, allSettings, audit, id, nowIso, db } from './db.js';

/** Currencies a hotel like this one actually deals with in Addis. */
export const CURRENCIES = {
  ETB: { code: 'ETB', symbol: 'Br', label: 'Ethiopian Birr', decimals: 2 },
  USD: { code: 'USD', symbol: '$', label: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', label: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', label: 'British Pound', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', label: 'UAE Dirham', decimals: 2 },
  SAR: { code: 'SAR', symbol: 'SAR', label: 'Saudi Riyal', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', decimals: 2 },
  KES: { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling', decimals: 2 },
  DJF: { code: 'DJF', symbol: 'Fdj', label: 'Djibouti Franc', decimals: 0 },
  CAD: { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', label: 'Japanese Yen', decimals: 0 },
};

/** Sensible starting point so the app is never stuck with no rates at all. */
const FALLBACK_RATES = {
  USD: 57.5, EUR: 62.5, GBP: 73.5, AED: 15.65, SAR: 15.35, CNY: 7.95,
  KES: 0.45, DJF: 0.325, CAD: 41.5, CHF: 66, JPY: 0.38,
};

const NBE_ENDPOINTS = [
  // The published NBE rate feed, then the two shapes the site has served over time.
  { url: 'https://nbe.gov.et/api/exchangerate/', parse: parseNbeFeed },
  { url: 'https://nbe.gov.et/api/exchangerates/', parse: parseNbeFeed },
  { url: 'https://www.nbe.gov.et/api/exchangerate/', parse: parseNbeFeed },
];

/** NBE returns either { USD: 57.5 } or [{ currency: 'USD', buying/selling }]. */
function parseNbeFeed(json) {
  const out = {};
  if (!json) return out;
  const rows = Array.isArray(json) ? json : Array.isArray(json.rates) ? json.rates : json.data && Array.isArray(json.data) ? json.data : [];
  if (rows.length) {
    for (const row of rows) {
      const code = String(row.currency || row.code || row.Currency || row.currencyCode || '').toUpperCase();
      const mid = Number(row.selling ?? row.selling_rate ?? row.rate ?? row.value ?? 0);
      const buy = Number(row.buying ?? row.buying_rate ?? 0);
      const value = mid && buy ? (mid + buy) / 2 : mid || buy;
      if (CURRENCIES[code] && value > 0) out[code] = Number(value.toFixed(4));
    }
    return out;
  }
  // plain { USD: 57.5, ... }
  for (const [key, value] of Object.entries(json)) {
    const code = key.toUpperCase();
    if (CURRENCIES[code] && Number(value) > 0) out[code] = Number(Number(value).toFixed(4));
  }
  return out;
}

function storedRates() {
  const raw = getSetting('fx_rates') || FALLBACK_RATES;
  const rates = { ETB: 1, ...FALLBACK_RATES, ...(typeof raw === 'string' ? safeParse(raw) : raw) };
  return rates;
}

const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

/** Everything the UI needs: the rates, where they came from and how fresh they are. */
export function rateCard() {
  const settings = allSettings();
  return {
    base: 'ETB',
    rates: storedRates(),
    source: settings.fx_source || 'manual',
    source_label: {
      nbe: 'National Bank of Ethiopia (official)',
      manual: 'Set by the hotel',
      cache: 'Last official rates we downloaded',
      fallback: 'Built-in starting rates — press Refresh',
    }[settings.fx_source || 'manual'] || settings.fx_source,
    updated_at: settings.fx_updated_at || null,
    enabled: settings.fx_enabled !== 0,
    currencies: Object.values(CURRENCIES),
  };
}

/**
 * Pull the official rates. Returns { ok, source, rates, error } — never throws,
 * because a hotel cannot stop working when the internet blinks.
 */
export async function refreshRates({ actor } = {}) {
  for (const endpoint of NBE_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(endpoint.url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'CloveHouse-PMS/2 (+hotel front desk)' },
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const json = await response.json();
      const parsed = endpoint.parse(json);
      const usable = Object.keys(parsed).length;
      if (usable < 3) continue;

      const rates = { ETB: 1, ...storedRates(), ...parsed };
      setSetting('fx_rates', JSON.stringify(rates));
      setSetting('fx_source', 'nbe');
      setSetting('fx_updated_at', nowIso());
      audit({ actor, action: 'fx-refresh', entity: 'settings', entityId: 'fx', detail: `Official rates from NBE (${usable} currencies)` });
      return { ok: true, source: 'nbe', rates, error: null };
    } catch (error) {
      // try the next endpoint; the last failure is reported at the end
      var lastError = error.message; // eslint-disable-line no-var
    }
  }

  // Nothing reachable: keep the hotel working on the last known rates and be honest about it.
  const settings = allSettings();
  const haveOfficial = settings.fx_source === 'nbe' && settings.fx_rates;
  if (haveOfficial) {
    setSetting('fx_source', 'cache');
    audit({ actor, action: 'fx-refresh', entity: 'settings', entityId: 'fx', detail: `Official feed unreachable (${lastError || 'network'}) — using cached rates` });
    return { ok: false, source: 'cache', rates: storedRates(), error: `Could not reach the National Bank feed (${lastError || 'network'}). Using the last rates downloaded.` };
  }
  setSetting('fx_source', settings.fx_source || 'fallback');
  return { ok: false, source: settings.fx_source || 'fallback', rates: storedRates(), error: `Could not reach the National Bank feed (${lastError || 'network'}). Enter today's rates by hand — the desk keeps working.` };
}

/** Manager types today's rates in: saved immediately, marked as hotel-set. */
export function saveRates({ rates = {}, actor } = {}) {
  const clean = {};
  for (const [code, value] of Object.entries(rates)) {
    const upper = String(code).toUpperCase();
    const number = Number(value);
    if (CURRENCIES[upper] && number > 0) clean[upper] = Number(number.toFixed(4));
  }
  if (!Object.keys(clean).length) return { error: 'Enter at least one rate.' };
  const rates2 = { ETB: 1, ...storedRates(), ...clean };
  setSetting('fx_rates', JSON.stringify(rates2));
  setSetting('fx_source', 'manual');
  setSetting('fx_updated_at', nowIso());
  audit({ actor, action: 'fx-manual', entity: 'settings', entityId: 'fx', detail: `Rates set by hand: ${Object.keys(clean).join(', ')}` });
  return { ok: true, rates: rates2 };
}

/** ETB → currency. */
export function toCurrency(amountEtb, code, rate) {
  const currency = String(code || 'ETB').toUpperCase();
  if (currency === 'ETB') return Number(amountEtb) || 0;
  const value = Number(rate) || storedRates()[currency] || 1;
  return (Number(amountEtb) || 0) / value;
}

/** currency → ETB. */
export function toEtb(amountForeign, code, rate) {
  const currency = String(code || 'ETB').toUpperCase();
  if (currency === 'ETB') return Number(amountForeign) || 0;
  const value = Number(rate) || storedRates()[currency] || 1;
  return (Number(amountForeign) || 0) * value;
}

/** The rate to freeze onto a stay when the guest checks in. */
export function rateFor(code) {
  const currency = String(code || 'ETB').toUpperCase();
  if (currency === 'ETB') return 1;
  return storedRates()[currency] || null;
}

/**
 * Keep the rates fresh without anybody pressing anything: once a day, quietly.
 * If it fails, nothing happens and the cached rates stay in use.
 */
export function startRateScheduler() {
  const run = async () => {
    const settings = allSettings();
    const last = settings.fx_updated_at ? new Date(settings.fx_updated_at).getTime() : 0;
    const stale = Date.now() - last > 12 * 60 * 60 * 1000;
    if (!stale || settings.fx_source === 'manual') return;
    const result = await refreshRates({ actor: { id: null, name: 'Scheduler', role: 'system' } });
    if (!result.ok) console.log(`  · rates: ${result.error}`);
  };
  const timer = setInterval(run, 6 * 60 * 60 * 1000);
  timer.unref?.();
  setTimeout(run, 15_000).unref?.();
  return timer;
}

/** Money for a receipt: "1,840.00 ETB (32.00 USD @ 57.50)". */
export function dualAmount(amountEtb, { currency, rate } = {}) {
  const meta = CURRENCIES[String(currency || 'ETB').toUpperCase()];
  if (!meta || meta.code === 'ETB') return null;
  const foreign = toCurrency(amountEtb, meta.code, rate);
  const decimals = meta.decimals ?? 2;
  return {
    currency: meta.code,
    symbol: meta.symbol,
    amount: Number(foreign.toFixed(decimals)),
    rate: Number(rate) || storedRates()[meta.code],
    text: `${meta.symbol} ${foreign.toFixed(decimals)}`,
  };
}

/** Bookkeeping view for the manager: what foreign money was taken and at what rate. */
export function currencySummary({ from, to } = {}) {
  const rows = db
    .prepare(
      `SELECT currency, fx_rate, COUNT(*) AS lines, SUM(ABS(amount)) AS etb
       FROM folio_items
       WHERE kind = 'payment' AND void = 0 AND currency IS NOT NULL AND currency != 'ETB'
         AND (? IS NULL OR bill_date >= ?) AND (? IS NULL OR bill_date <= ?)
       GROUP BY currency, fx_rate
       ORDER BY currency`,
    )
    .all(from || null, from || null, to || null, to || null);
  return rows.map((row) => ({
    currency: row.currency,
    rate: row.fx_rate,
    lines: row.lines,
    etb: row.etb,
    foreign: row.fx_rate ? Number((row.etb / row.fx_rate).toFixed(CURRENCIES[row.currency]?.decimals ?? 2)) : null,
  }));
}

export { FALLBACK_RATES };
