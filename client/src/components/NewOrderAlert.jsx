import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { STATIONS } from '../../../shared/billing.js';

/**
 * The cashier's full-screen ring: a guest scanned the QR code in their room and
 * ordered. Nothing else on the screen matters until it is accepted or declined.
 */
export default function NewOrderAlert({ onOpenOrders }) {
  const { alerts, dismissAlert, toast, loadOrders, settings } = useApp();
  const [busy, setBusy] = useState(false);
  const alert = alerts.find((item) => item.kind === 'order.new');
  if (!alert?.order) return null;
  const { order } = alert;

  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'accept') {
        await api.post(`/orders/${order.id}/accept`, { call_confirmed: true });
        toast(`Order #${order.code} accepted and marked as confirmed by phone. Now send it to the stations.`);
      }
      if (action === 'accept-send') {
        await api.post(`/orders/${order.id}/accept`, { call_confirmed: false });
        await api.post(`/orders/${order.id}/send`);
        toast(`Order #${order.code} sent to the kitchen, barista and juice stations.`);
      }
      if (action === 'decline') {
        await api.post(`/orders/${order.id}/cancel`, { reason: 'Declined at the cashier desk' });
        toast(`Order #${order.code} declined.`, 'info');
      }
      await loadOrders();
      dismissAlert(order.id);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="alert-overlay" role="alertdialog" aria-modal="true">
      <div className="alert-card">
        <header>
          <div className="bell"><Icon name="bell" size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', opacity: .85, fontWeight: 700 }}>
              {order.channel === 'qr' ? 'QR order from the room' : 'New order'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3 }}>
              Room {order.room_number} · {order.guest_name}
            </div>
          </div>
        </header>

        <div className="body">
          <ul className="items" style={{ margin: 0 }}>
            {order.items.map((item) => (
              <li key={item.id} style={{ padding: '7px 0', borderBottom: '1px solid #f2f6f5', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <strong>{item.qty}×</strong> {item.name}
                </span>
                <span className="tiny muted">{STATIONS[item.station]?.label || item.station}</span>
              </li>
            ))}
          </ul>
          {order.note ? (
            <div className="banner warn" style={{ marginTop: 12 }}>
              <Icon name="alert" size={15} />
              <span>{order.note}</span>
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <span className="muted small">
              <Icon name="clock" size={12} /> arrived {Math.max(0, Math.round(order.ageMs / 60000))} min ago
            </span>
            <span className="big-amount">{money(order.total)}</span>
          </div>
        </div>

        <div className="foot">
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={busy} onClick={() => act('accept')}>
            <Icon name="check" size={16} /> Accept · called &amp; confirmed
          </button>
          <button className="btn btn-lg" disabled={busy} onClick={() => act('accept-send')}>
            <Icon name="send" size={15} /> Accept &amp; send now
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => act('decline')}>
            Decline
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              onOpenOrders?.();
              dismissAlert(order.id);
            }}
          >
            Later
          </button>
        </div>
        <div className="tiny muted" style={{ padding: '0 22px 18px' }}>
          {settings.require_call_confirmation ? 'Your hotel asks the desk to call the guest before the food is prepared.' : ''}
          {' '}The order stays in the Orders desk until it is accepted.
        </div>
      </div>
    </div>
  );
}
