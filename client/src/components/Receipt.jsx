import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { api } from '../lib/api.js';
import { Icon } from '../lib/icons.jsx';

/**
 * The hotel's paper receipt — laid out like the official fiscal slip the desk
 * prints on the 80 mm thermal printer: TIN, business name, FS number, invoice
 * code, item columns, big TOTAL, payment line. No tax lines, no QR block.
 *
 * Money is split the way the owner keeps it: the ROOM prints in the guest's own
 * currency (the price per night written at check-in), while food and other
 * services print in birr. Every print leaves a soft copy for the admin page.
 */

const money2 = (value) => money(Math.round(Number(value) || 0));

const when = (value) => (value
  ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const pad = (value) => String(value).padStart(2, '0');

function invoiceCode(at = new Date()) {
  return `CS_${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}_${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ------------------------------------------------------------------ */
/* The receipt model: blocks of rows, each total in its own currency.  */
/* ------------------------------------------------------------------ */

export function buildReceipt(folio, room, order) {
  if (order) return orderReceipt(order);
  return folioReceipt(folio, room);
}

function folioReceipt(folio, room) {
  const totals = folio?.totals || {};
  const live = folio?.live || null;
  const items = folio?.items || [];
  const roomPosted = totals.roomPosted > 0;
  const roomAmount = totals.room || 0;

  const gcur = (folio?.currency || 'ETB').toUpperCase();
  const gfx = Number(folio?.fx_rate) || 1;
  const foreign = gcur !== 'ETB' && gfx > 0;
  const rateForeign = Number(folio?.rate_foreign) || (foreign ? (Number(folio?.rate) || 0) / gfx : Number(folio?.rate) || 0);

  // The room prints in the guest's money: units × the price per night written
  // at check-in. Everything else is birr.
  const roomUnits = roomPosted ? (live?.billedUnits || '') : (live?.billedUnits || '');
  const roomRows = roomAmount > 0 ? [{
    name: `Room ${room?.number || folio?.room_number || '—'} · ${roomPosted ? 'posted' : live ? `${live.billedUnits} ${live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural}` : 'stay'}`,
    qty: roomUnits || '',
    price: rateForeign ? rateForeign.toFixed(3) : '',
    amount: foreign ? roomAmount / gfx : roomAmount,
    currency: gcur,
  }] : [];

  const extraItems = items.filter((i) => i.kind !== 'payment' && i.kind !== 'room');
  const extraRows = extraItems.map((item) => ({
    name: item.description,
    qty: Number(item.qty) > 1 ? item.qty : '',
    price: Number(item.qty) > 1 ? (item.amount / item.qty).toFixed(3) : '',
    amount: item.amount,
    currency: 'ETB',
  }));

  const payments = items.filter((i) => i.kind === 'payment').map((item) => ({
    label: String(item.method || 'Cash').toUpperCase(),
    amount: item.currency && item.foreign_amount ? item.foreign_amount : Math.abs(item.amount),
    currency: item.currency || 'ETB',
    etb: Math.abs(item.amount),
  }));
  // A settled bill prints its CASH line; an open one prints BALANCE instead.
  if (!payments.length && roomAmount && !(totals.balance > 0)) {
    payments.push({
      label: 'CASH',
      amount: foreign ? (roomAmount + extraRows.reduce((s, r) => s + r.amount, 0)) / gfx : totals.total || 0,
      currency: foreign ? gcur : 'ETB',
      etb: totals.total || 0,
    });
  }

  return {
    kind: 'folio',
    stayId: folio?.id || null,
    guestName: folio?.guest?.full_name || '—',
    roomLabel: `Room ${room?.number || folio?.room_number || '—'}`,
    meta: [
      ['Room', room?.number || folio?.room_number || '—'],
      ['Guest', folio?.guest?.full_name || '—'],
      ['Check-in', when(folio?.check_in_at)],
      ['Check-out', when(folio?.check_out_at || Date.now())],
    ],
    blocks: [
      { title: null, rows: roomRows, totalLabel: foreign ? `ROOM TOTAL (${gcur})` : null, total: foreign ? roomRows.reduce((s, r) => s + r.amount, 0) : null, currency: gcur },
      { title: foreign ? 'Food & services (ETB)' : null, rows: extraRows, totalLabel: foreign ? 'EXTRAS TOTAL (ETB)' : null, total: foreign ? extraRows.reduce((s, r) => s + r.amount, 0) : null, currency: 'ETB' },
    ],
    grand: foreign
      ? [
        { amount: roomRows.reduce((s, r) => s + r.amount, 0), currency: gcur },
        { amount: extraRows.reduce((s, r) => s + r.amount, 0), currency: 'ETB' },
      ]
      : [{ amount: totals.total || 0, currency: 'ETB' }],
    payments,
    balance: totals.balance || 0,
    balanceForeign: foreign ? (totals.balance || 0) / gfx : null,
    currency: gcur,
    fxRate: gfx,
    roomTotalForeign: foreign ? roomRows.reduce((s, r) => s + r.amount, 0) : (totals.room || 0),
    roomTotalEtb: totals.room || 0,
    extrasTotalEtb: extraRows.reduce((s, r) => s + r.amount, 0),
    totalEtb: totals.total || 0,
  };
}

function orderReceipt(order) {
  const rows = (order.items || []).map((item) => ({
    name: item.name,
    qty: item.qty,
    price: (item.unit_price || 0).toFixed(3),
    amount: item.qty * item.unit_price,
    currency: 'ETB',
  }));
  return {
    kind: 'order',
    orderId: order.id || null,
    guestName: order.guest_name || '—',
    roomLabel: order.table_name || (order.room_id ? `Room ${order.room_number}` : 'Counter'),
    meta: [
      ['Order', order.code],
      order.table_name ? ['Table', order.table_name] : ['Room', order.room_number],
      ['Waiter', 'Cashier'],
    ],
    blocks: [{ title: null, rows, totalLabel: null, total: null, currency: 'ETB' }],
    grand: [{ amount: order.total, currency: 'ETB' }],
    payments: [{ label: order.charged && order.stay_id ? 'ROOM BILL' : 'CASH', amount: order.total, currency: 'ETB', etb: order.total }],
    balance: 0,
    balanceForeign: null,
    currency: 'ETB',
    fxRate: 1,
    roomTotalForeign: 0,
    roomTotalEtb: 0,
    extrasTotalEtb: order.total,
    totalEtb: order.total,
  };
}

/* ------------------------------- sheet -------------------------------- */

export function ReceiptSheet({ folio, room, order, invoiceNo, fs, when: whenNow, data: dataIn }) {
  const { settings, user } = useApp();
  const data = dataIn || buildReceipt(folio, room, order);
  const now = whenNow || new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const code = invoiceNo || invoiceCode(now);
  const flatRows = data.blocks.flatMap((block) => block.rows);
  const itemCount = flatRows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0) || flatRows.length;

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

      {data.blocks.map((block, index) => (
        <div key={index}>
          {block.title ? <div className="r-block-title">{block.title}</div> : null}
          <div className="r-lines">
            {block.rows.length ? block.rows.map((row, rowIndex) => (
              <div className="r-line" key={rowIndex}>
                <div className="r-desc">{row.name}</div>
                <div className="r-num">{row.qty}</div>
                <div className="r-num">{row.price}</div>
                <div className="r-num">*{(Number(row.amount) || 0).toFixed(2)}{row.currency && row.currency !== 'ETB' ? ` ${row.currency}` : ''}</div>
              </div>
            )) : (
              <div className="r-line"><div className="r-desc">No charges</div><div className="r-num" /><div className="r-num" /><div className="r-num">*0.00</div></div>
            )}
          </div>
          {block.totalLabel ? (
            <div className="r-pay">
              <span>{block.totalLabel}</span>
              <span>*{(Number(block.total) || 0).toFixed(2)}</span>
            </div>
          ) : null}
          {block.totalLabel ? <div className="r-sep">--------------------------------</div> : null}
        </div>
      ))}

      {data.grand.map((line) => (
        <div className="r-total" key={line.currency}>
          <span>{data.grand.length > 1 ? `TOTAL (${line.currency})` : 'TOTAL'}</span>
          <span>*{(Number(line.amount) || 0).toFixed(2)}</span>
        </div>
      ))}

      {data.payments.map((payment, index) => (
        <div className="r-pay" key={index}>
          <span>{payment.label}</span>
          <span>*{(Number(payment.amount) || 0).toFixed(2)} {payment.currency}</span>
        </div>
      ))}

      {data.balance ? (
        <div className="r-pay">
          <span>BALANCE</span>
          <span>*{(Number(data.balance) || 0).toFixed(2)} ETB</span>
        </div>
      ) : null}
      {data.balanceForeign ? (
        <div className="r-pay">
          <span>BALANCE ({data.currency})</span>
          <span>*{(Number(data.balanceForeign) || 0).toFixed(2)} {data.currency}</span>
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

/** Keep the soft copy: the admin page and the reports read this back. */
export async function archiveReceipt({ data, invoiceNo, fs }) {
  try {
    await api.post('/receipts', {
      invoice_no: invoiceNo,
      kind: data.kind,
      stay_id: data.stayId || undefined,
      order_id: data.orderId || undefined,
      room_label: data.roomLabel,
      guest_name: data.guestName,
      currency: data.currency || 'ETB',
      fx_rate: data.fxRate || 1,
      room_total_foreign: data.roomTotalForeign || 0,
      room_total_etb: data.roomTotalEtb || 0,
      extras_total_etb: data.extrasTotalEtb || 0,
      total_etb: data.totalEtb || 0,
      rows: data,
      meta: data.meta,
      fs: fs || null,
    });
  } catch {
    // offline: the paper is already printed; the copy catches up next time
  }
}

/**
 * Modal with the receipt and a Print button. Printing claims the next FS
 * number first (reprints keep the number they were printed with) and leaves a
 * soft copy behind for the admin.
 */
export function ReceiptModal({ folio, room, order, data: dataIn, archive = true, onClose, title = 'Receipt' }) {
  const { toast } = useApp();
  const [fs, setFs] = useState(() => dataIn?.fs || null);
  const [invoiceNo] = useState(() => invoiceCode());
  const [printedAt] = useState(() => new Date());
  const data = dataIn || buildReceipt(folio, room, order);

  const fixedFs = dataIn?.fs || null;

  const doPrint = async () => {
    let usedFs = fs || fixedFs;
    if (!fixedFs) {
      try {
        const result = await api.post('/receipt/next-fs');
        if (result?.fs) {
          usedFs = result.fs;
          setFs(result.fs);
        }
      } catch {
        // offline or no permission: print with the template's FS number
      }
    }
    if (archive && !fixedFs) await archiveReceipt({ data, invoiceNo, fs: usedFs || undefined });
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
          <ReceiptSheet data={data} invoiceNo={invoiceNo} fs={fs} when={printedAt} />
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

export { invoiceCode };
