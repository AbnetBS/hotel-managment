import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { api } from '../lib/api.js';
import { Icon } from '../lib/icons.jsx';

/**
 * The hotel's paper receipt — laid out like the official fiscal slip the desk
 * prints on the 80 mm thermal printer: TIN, business name, FS number, invoice
 * code, item columns, big TOTAL, payment line. No tax lines, no QR block: this
 * is the demo receipt, not the fiscal one. The head and foot come from the
 * admin's receipt template.
 */

const money2 = (value) => money(Math.round(Number(value) || 0));
const money3 = (value) => (Number(value) || 0).toFixed(3);

const when = (value) => (value
  ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const pad = (value) => String(value).padStart(2, '0');

function invoiceCode(at = new Date()) {
  return `CS_${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}_${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ------------------------------------------------------------------ */
/* Rows: [{ name, qty, price, amount }] plus meta lines and payments. */
/* ------------------------------------------------------------------ */

function folioReceipt(folio, room) {
  const totals = folio?.totals || {};
  const live = folio?.live || null;
  const items = folio?.items || [];
  const roomPosted = totals.roomPosted > 0;
  const roomAmount = totals.room || 0;

  const rows = [];
  if (roomAmount > 0) {
    rows.push({
      name: `Room ${room?.number || folio?.room_number || '—'} · ${roomPosted ? 'posted' : live ? `${live.billedUnits} ${live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural}` : 'stay'}`,
      qty: roomPosted ? '' : live?.billedUnits || '',
      price: folio?.rate ? money3(folio.rate) : '',
      amount: roomAmount,
    });
  }
  for (const item of items.filter((i) => i.kind !== 'payment' && i.kind !== 'room')) {
    rows.push({
      name: item.description,
      qty: Number(item.qty) > 1 ? item.qty : '',
      price: Number(item.qty) > 1 ? money3(item.amount / item.qty) : '',
      amount: item.amount,
    });
  }

  const payments = items.filter((i) => i.kind === 'payment');
  return {
    meta: [
      ['Room', room?.number || folio?.room_number || '—'],
      ['Guest', folio?.guest?.full_name || '—'],
      ['Check-in', when(folio?.check_in_at)],
      ['Check-out', when(folio?.check_out_at || Date.now())],
    ],
    rows,
    total: totals.total || 0,
    payments: payments.length
      ? payments.map((item) => ({ label: String(item.method || 'Cash').toUpperCase(), amount: Math.abs(item.amount) }))
      : [{ label: 'CASH', amount: totals.total || 0 }],
    balance: totals.balance || 0,
  };
}

function orderReceipt(order) {
  return {
    meta: [
      ['Order', order.code],
      order.table_name ? ['Table', order.table_name] : ['Room', order.room_number],
      ['Waiter', 'Cashier'],
    ],
    rows: (order.items || []).map((item) => ({
      name: item.name,
      qty: item.qty,
      price: money3(item.unit_price),
      amount: item.qty * item.unit_price,
    })),
    total: order.total,
    payments: [{ label: order.charged && order.stay_id ? 'ROOM BILL' : 'CASH', amount: order.total }],
    balance: 0,
  };
}

/* ------------------------------- sheet -------------------------------- */

export function ReceiptSheet({ folio, room, order, invoiceNo, fs, when: whenNow }) {
  const { settings, user } = useApp();
  const data = order ? orderReceipt(order) : folioReceipt(folio, room);
  const now = whenNow || new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const code = invoiceNo || invoiceCode(now);
  const itemCount = data.rows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0) || data.rows.length;

  return (
    <div className="receipt-paper">
      <div className="r-tin">TIN: {settings.receipt_tin || '—'}</div>
      <div className="r-hotel">{String(settings.receipt_name || settings.hotel_name || 'HOTEL').toUpperCase()}</div>
      {String(settings.receipt_address || settings.address || '').split('\n').filter(Boolean).map((line) => (
        <div className="r-center" key={line}>{line}</div>
      ))}
      {settings.receipt_phone || settings.phone ? (
        <div className="r-center">TEL-{settings.receipt_phone || settings.phone}</div>
      ) : null}

      <div className="r-fsline">
        <span>FS No. {fs || settings.receipt_fs || '—'}</span>
        <span>{time}</span>
      </div>
      <div className="r-dateline">{date}</div>

      <div className="r-banner">====== {String(settings.receipt_title || 'CASH INVOICE').toUpperCase()} ======</div>

      <div className="r-meta">
        <div>Invoice: {code}</div>
        {data.meta.map(([label, value]) => <div key={label}>{label}: {value}</div>)}
        <div>Operator: {user?.name || '—'}</div>
      </div>

      <div className="r-sep">--------------------------------</div>

      <div className="r-cols">
        <span>Description</span>
        <span>Qty</span>
        <span>Price</span>
        <span>AMOUNT</span>
      </div>

      <div className="r-sep">--------------------------------</div>

      <div className="r-lines">
        {data.rows.length ? data.rows.map((row, index) => (
          <div className="r-line" key={index}>
            <div className="r-desc">{row.name}</div>
            <div className="r-num">{row.qty}</div>
            <div className="r-num">{row.price}</div>
            <div className="r-num">*{(Number(row.amount) || 0).toFixed(2)}</div>
          </div>
        )) : (
          <div className="r-line"><div className="r-desc">No charges</div><div className="r-num" /><div className="r-num" /><div className="r-num">*0.00</div></div>
        )}
      </div>

      <div className="r-sep">--------------------------------</div>

      <div className="r-total">
        <span>TOTAL</span>
        <span>*{(Number(data.total) || 0).toFixed(2)}</span>
      </div>

      {data.payments.map((payment) => (
        <div className="r-pay" key={payment.label}>
          <span>{payment.label}</span>
          <span>*{(Number(payment.amount) || 0).toFixed(2)}</span>
        </div>
      ))}

      {data.balance ? (
        <div className="r-pay">
          <span>BALANCE</span>
          <span>*{(Number(data.balance) || 0).toFixed(2)}</span>
        </div>
      ) : null}

      <div className="r-itemcount">ITEM# {itemCount}</div>
      <div className="r-foot">{settings.receipt_footer || ''}</div>
      {settings.receipt_footer2 ? <div className="r-foot">{settings.receipt_footer2}</div> : null}
    </div>
  );
}

/** Print the receipt paper that is currently on screen (80 mm thermal friendly). */
export function printReceipt() {
  document.body.classList.add('receipt-printing');
  const cleanup = () => {
    document.body.classList.remove('receipt-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
}

/**
 * Modal with the receipt and a Print button. Printing claims the next FS
 * number first, so every paper slip carries its own serial.
 * Used at checkout, from the room drawer and for order receipts.
 */
export function ReceiptModal({ folio, room, order, onClose, title = 'Receipt' }) {
  const { toast } = useApp();
  const [fs, setFs] = useState(null);
  const [invoiceNo] = useState(() => invoiceCode());
  const [printedAt] = useState(() => new Date());

  const doPrint = async () => {
    try {
      const result = await api.post('/receipt/next-fs');
      if (result?.fs) setFs(result.fs);
    } catch {
      // offline or no permission: print with the template's FS number
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    printReceipt();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="modal receipt-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className="modal-body receipt-stage">
          <ReceiptSheet folio={folio} room={room} order={order} invoiceNo={invoiceNo} fs={fs} when={printedAt} />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={doPrint}>
            <Icon name="print" size={15} /> Print receipt
          </button>
        </div>
      </div>
    </div>
  );
}
