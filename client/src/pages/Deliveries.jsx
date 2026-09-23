import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useNow } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money, relative } from '../lib/format.js';
import { Stat, Empty } from '../lib/ui.jsx';
import { STATIONS } from '../../../shared/billing.js';

/** Waiter board: everything that should already be in a guest's hands. */
export default function Deliveries() {
  const { user, orders, toast, loadOrders } = useApp();
  const [busy, setBusy] = useState('');
  const now = useNow(5000);

  const toDeliver = orders.filter((order) => order.status === 'delivering');
  const ready = orders.filter((order) => order.status === 'ready');
  const mine = orders.filter((order) => order.delivered_by === user.id && ['delivered', 'completed'].includes(order.status));

  const deliver = async (order) => {
    setBusy(order.id);
    try {
      const result = await api.post(`/orders/${order.id}/deliver`);
      toast(
        result.charged
          ? `Order #${order.code} delivered to Room ${order.room_number} and added to the guest bill.`
          : `Order #${order.code} delivered.`,
      );
      await loadOrders();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Room service · {relative(new Date(now).toISOString(), now)}</div>
          <h1>Deliveries</h1>
          <p className="page-desc">
            Take the cart, follow the list. Tap <strong>Delivered to the room</strong> when the guest has it — that puts the money on their bill
            straight away, so nothing is forgotten at checkout.
          </p>
        </div>
        <button className="btn" onClick={loadOrders}>
          <Icon name="rotate-ccw" size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Take now" value={toDeliver.length} icon="send" alert={toDeliver.length > 0} foot="Already on the pass, go" />
        <Stat label="Plates ready" value={ready.length} icon="check-circle" foot="Waiting for the cashier to send you" />
        <Stat label="Delivered by you" value={mine.length} icon="users" foot="This shift" />
      </div>

      {toDeliver.length === 0 ? (
        <Empty title="Nothing to carry right now" hint="When the cashier sends a waiter, the order appears here with a sound." icon="send" />
      ) : (
        <div className="grid grid-3">
          {toDeliver.map((order) => (
            <section className="station-ticket" key={order.id}>
              <header style={{ background: 'var(--teal-dark)' }}>
                <div>
                  <div className="code">Room {order.room_number}</div>
                  <div className="tiny" style={{ color: '#b6ded3', marginTop: 3 }}>
                    {order.guest_name} · order #{order.code}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tiny" style={{ color: '#b6ded3' }}>sent</div>
                  <div className="tiny" style={{ color: '#eafaf5' }}>{relative(order.delivering_at || order.created_at, now)}</div>
                </div>
              </header>
              {order.items.map((item) => (
                <div className="item" key={item.id}>
                  <div className="qty">{item.qty}</div>
                  <div className="name">
                    {item.name}
                    <div className="tiny muted">{STATIONS[item.station]?.label || item.station}</div>
                  </div>
                  <span className="pill completed"><i />Ready</span>
                </div>
              ))}
              {order.note ? (
                <div style={{ padding: '10px 16px', background: 'var(--amber-soft)', fontSize: 12, color: '#7a571c' }}>
                  <Icon name="alert" size={12} /> {order.note}
                </div>
              ) : null}
              <div style={{ padding: 14 }}>
                <button className="btn btn-primary btn-lg btn-block" disabled={busy === order.id} onClick={() => deliver(order)}>
                  <Icon name="check" size={16} /> Delivered to Room {order.room_number}
                </button>
                <div className="tiny muted" style={{ marginTop: 8, textAlign: 'center' }}>
                  Adds {money(order.total)} to the room bill
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {ready.length ? (
        <>
          <div style={{ height: 22 }} />
          <div className="banner warn">
            <Icon name="clock" size={15} />
            <span>
              {ready.length} order(s) are plated and waiting for the cashier to send you:{' '}
              {ready.map((order) => `#${order.code} → Room ${order.room_number}`).join(', ')}
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}
