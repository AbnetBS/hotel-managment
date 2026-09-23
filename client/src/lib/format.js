import { formatElapsed, formatCountdown, BILLING_MODES } from '../../../shared/billing.js';

export { formatElapsed, formatCountdown, BILLING_MODES };

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });

/** ETB 3,900 */
export function money(value, { symbol = true } = {}) {
  const amount = Number(value) || 0;
  const text = currencyFormatter.format(Math.abs(amount)).replace('ETB', 'ETB ');
  return `${amount < 0 ? '−' : ''}${text}${symbol ? '' : ''}`;
}

export function number(value, digits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value) || 0);
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function timeOf(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dateOf(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function dateTimeOf(value) {
  if (!value) return '—';
  return `${dateOf(value)} · ${timeOf(value)}`;
}

export function dayLong(value) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function dayShort(value) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function relative(from, now = Date.now()) {
  const diff = now - new Date(from).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** ISO input value for <input type="datetime-local"> */
export function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

export function nightsBetween(arrival, departure) {
  if (!arrival || !departure) return 1;
  return Math.max(1, Math.round((new Date(departure) - new Date(arrival)) / 86400000));
}

export const moneyShort = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000) return `ETB ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return money(n);
};
