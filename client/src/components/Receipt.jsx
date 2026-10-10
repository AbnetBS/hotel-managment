import { useApp } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

const when = (value) => (value
  ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * The demo receipt: printed to look like the hotel's official paper receipt,
 * with one deliberate difference — it adds NO tax lines, because it is not the
 * fiscal receipt. Room nights, food, services and payments add up on their own.
 *
 * Printing goes through the browser print dialog, so any printer the desk
 * computer knows works — USB thermal receipt printers (80 mm) and captain
 * order printers included.
 */

const money2 = (value) => money(Math.round(Number(value) || 0));

export function ReceiptSheet({ folio, room }) {
  const { settings } = useApp();
  const totals = folio?.totals || {};
  const live = folio?.live || null;
  const items = folio?.items || [];
  const roomPosted = totals.roomPosted > 0;
  const roomAmount = totals.room || 0;

  const payments = items.filter((i) => i.kind === 'payment');
  const charges = items.filter((i) => i.kind !== 'payment' && i.kind !== 'room');
  const discountLines = items.filter((i) => i.kind === 'discount');

  const receiptNo = String(folio?.code || '—').toUpperCase();
  const now = new Date();

  return (
    <div className="receipt-paper">
      <div className="r-head">
        <div className="r-hotel">{String(settings.hotel_name || 'CLOVE HOUSE').toUpperCase()}</div>
        {settings.address ? <div>{settings.address}</div> : null}
        {settings.phone ? <div>Tel: {settings.phone}</div> : null}
        {settings.receipt_tin ? <div>{settings.receipt_tin}</div> : null}
      </div>

      <div className="r-title">
        <strong>RECEIPT</strong>
        <span>No. {receiptNo}</span>
      </div>

      <div className="r-meta">
        <div><span>Room</span><span>{room?.number || folio?.room_number || '—'}</span></div>
        <div><span>Guest</span><span>{folio?.guest?.full_name || '—'}</span></div>
        <div><span>Check-in</span><span>{when(folio?.check_in_at)}</span></div>
        <div><span>Check-out</span><span>{when(folio?.check_out_at || now)}</span></div>
        <div><span>Date</span><span>{when(now)}</span></div>
      </div>

      <div className="r-sep" />

      <table className="r-lines">
        <thead>
          <tr><th>DESCRIPTION</th><th>QTY</th><th>AMOUNT</th></tr>
        </thead>
        <tbody>
          {roomAmount > 0 ? (
            <tr>
              <td>
                Room {room?.number || folio?.room_number} · {roomPosted ? 'posted' : live ? `${live.billedUnits} ${live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural}` : ''}
                {folio?.rate ? <div className="r-sub">@ {money2(folio.rate)}</div> : null}
              </td>
              <td>{roomPosted ? '' : live?.billedUnits || ''}</td>
              <td>{money2(roomAmount)}</td>
            </tr>
          ) : null}
          {charges.map((item) => (
            <tr key={item.id}>
              <td>
                {item.description}
                {Number(item.qty) > 1 ? <div className="r-sub">{item.qty} × {money2(item.amount / item.qty)}</div> : null}
              </td>
              <td>{Number(item.qty) > 1 ? item.qty : ''}</td>
              <td>{money2(item.amount)}</td>
            </tr>
          ))}
          {discountLines.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td />
              <td>{money2(item.amount)}</td>
            </tr>
          ))}
          {!roomAmount && !charges.length && !discountLines.length ? (
            <tr><td>No charges</td><td /><td>{money2(0)}</td></tr>
          ) : null}
        </tbody>
      </table>

      <div className="r-sep" />

      <div className="r-totals">
        <div><span>Subtotal</span><span>{money2(totals.charges || 0)}</span></div>
        {totals.discount ? <div><span>Discount</span><span>−{money2(totals.discount)}</span></div> : null}
        <div className="r-grand"><span>TOTAL</span><span>{money2(totals.total || 0)}</span></div>
      </div>

      {payments.length ? (
        <div className="r-totals">
          {payments.map((item) => (
            <div key={item.id}><span>Paid · {item.method || 'Cash'}</span><span>{money2(Math.abs(item.amount))}</span></div>
          ))}
        </div>
      ) : null}

      <div className="r-totals">
        <div className="r-grand"><span>Balance</span><span>{money2(totals.balance || 0)}</span></div>
      </div>

      <div className="r-sep" />

      <div className="r-foot">
        <div>{settings.receipt_footer || 'Thank you for staying with us.'}</div>
        {settings.property_line ? <div>{settings.property_line}</div> : null}
      </div>
    </div>
  );
}

/** Print the receipt paper that is currently on screen. */
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

/** Modal with the receipt and a Print button — used at checkout and from the room drawer. */
export function ReceiptModal({ folio, room, onClose, title = 'Receipt' }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="modal receipt-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close-x" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className="modal-body receipt-stage">
          <ReceiptSheet folio={folio} room={room} />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={printReceipt}>
            <Icon name="print" size={15} /> Print receipt
          </button>
        </div>
      </div>
    </div>
  );
}
