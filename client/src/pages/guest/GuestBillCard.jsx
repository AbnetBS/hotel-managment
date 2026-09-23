import { money } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';

/** How many decimals each currency is normally quoted in. */
const DECIMALS = { JPY: 0, DJF: 0, KES: 0, CNY: 2 };
const SYMBOL = { USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', KES: 'KSh', DJF: 'Fdj', CAD: 'C$', CHF: 'CHF' };

/**
 * A guest paying in dollars must never have to divide birr in their head.
 * The rate was frozen when the guest checked in, so the amounts never move.
 */
export function useGuestMoney(bill) {
  const currency = bill?.display_currency || 'ETB';
  const rate = Number(bill?.display_rate) || null; // birr per one unit of the guest's currency
  const decimals = DECIMALS[currency] ?? 2;

  const format = (etb) => {
    if (!rate) return money(etb);
    const value = Number(etb || 0) / rate;
    const sign = value < 0 ? '-' : '';
    return `${sign}${SYMBOL[currency] || ''} ${Math.abs(value).toFixed(decimals)}`.trim();
  };

  return { currency, rate, format, foreign: currency !== 'ETB' && Boolean(rate) };
}

/**
 * The whole bill: room, food, services, payments, tax — in the guest's money.
 */
export default function GuestBillCard({ bill, room, loading }) {
  const { format, foreign, currency, rate } = useGuestMoney(bill);

  if (loading) {
    return (
      <div className="card card-pad">
        <h2>Your bill</h2>
        <p className="small muted" style={{ marginTop: 10 }}>Adding it up…</p>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="card card-pad">
        <h2>Your bill · ሂሳብዎ</h2>
        <p className="small muted" style={{ marginTop: 10 }}>
          Nothing is charged to Room {room?.number} yet. Anything you order from the room appears here straight away.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Your bill · ሂሳብዎ</h2>
            <p className="small muted" style={{ marginTop: 6 }}>Everything charged to Room {room?.number} during your stay.</p>
          </div>
          <span className="pill open"><i />{bill.stay?.code}</span>
        </div>

        {foreign ? (
          <div className="banner info" style={{ marginTop: 12 }}>
            <Icon name="exchange" size={15} />
            <span>
              You are billed in <strong>{currency}</strong> at the rate agreed when you checked in ({rate} birr per 1 {currency}).
              The desk takes payment in {currency}.
            </span>
          </div>
        ) : null}

        <div className="bill" style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 12 }}>
          <div className="bill-line">
            <div className="desc">
              <strong>Room · {bill.room.line}</strong>
              <small>{bill.room.live ? 'still running — updated live' : 'final room charge'}</small>
            </div>
            <strong>{format(bill.room.total)}</strong>
          </div>

          {(bill.groups || []).map((group) => (
            <div key={group.kind}>
              <div className="bill-line" style={{ background: '#f8fbfa' }}>
                <div className="desc"><strong>{group.title}</strong><small>{group.title_am}</small></div>
                <strong>{format(group.total)}</strong>
              </div>
              {group.lines.map((line) => (
                <div className="bill-line" key={line.id}>
                  <div className="desc">
                    {line.qty > 1 ? `${line.qty}× ` : ''}{line.description}
                    <small>{new Date(line.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <strong>{format(line.amount)}</strong>
                </div>
              ))}
            </div>
          ))}

          {Number(bill.discount) > 0 ? (
            <div className="bill-line neg">
              <div className="desc">Discount · ቅናሽ</div>
              <strong>-{format(bill.discount)}</strong>
            </div>
          ) : null}
          {bill.service_charge_percent ? (
            <div className="bill-line">
              <div className="desc">Service charge · {bill.service_charge_percent}%</div>
              <strong>{format(bill.service)}</strong>
            </div>
          ) : null}
          {bill.vat_percent ? (
            <div className="bill-line">
              <div className="desc">VAT · {bill.vat_percent}%</div>
              <strong>{format(bill.vat)}</strong>
            </div>
          ) : null}
          <div className="bill-total">
            <span>Total{bill.groups?.length ? ' so far' : ''}</span>
            <span>{format(bill.total)}</span>
          </div>
          {bill.paid ? (
            <div className="bill-line">
              <div className="desc">Already paid</div>
              <strong>-{format(bill.paid)}</strong>
            </div>
          ) : null}
          <div className="bill-total due">
            <span>Balance to pay at the desk</span>
            <span>{format(bill.balance)}</span>
          </div>
        </div>

        {foreign ? (
          <p className="small muted" style={{ marginTop: 10 }}>
            In birr: {money(bill.total)} total · {money(bill.balance)} still to pay.
          </p>
        ) : null}
      </div>

      {(bill.payments || []).length ? (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 8 }}>Payments received</h3>
          {bill.payments.map((payment) => (
            <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }} key={payment.id}>
              <span className="small">{payment.description}</span>
              <strong className="small">{format(payment.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="banner info">
        <Icon name="receipt" size={15} />
        <span>{bill.note}</span>
      </div>
    </div>
  );
}
