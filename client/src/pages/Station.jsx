import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { Stat, Empty, Seg } from '../lib/ui.jsx';
import { STATIONS } from '../../../shared/billing.js';

const ROLE_STATION = { kitchen: 'kitchen', pastry: 'pastry', barista: 'barista', juice: 'juice' };

/**
 * Kitchen / barista / juice screen. One ticket per order, only the items that
 * belong to this station. Accept → Done. When everything on an order is done the
 * cashier is told automatically that a waiter can be sent.
 */
export default function Station() {
  const { user, orders, toast, loadOrders, menu, loadAll } = useApp();
  const [station, setStation] = useState(ROLE_STATION[user.role] || 'kitchen');
  const [busy, setBusy] = useState('');
  const [extra, setExtra] = useState([]);

  useEffect(() => {
    const id = setInterval(() => loadOrders(), 20000);
    return () => clearInterval(id);
  }, [loadOrders]);

  const stationOrders = useMemo(
    () =>
      orders
        .filter((order) => ['sent', 'ready'].includes(order.status))
        .map((order) => ({ ...order, items: order.items.filter((item) => item.station === station) }))
        .filter((order) => order.items.length),
    [orders, station],
  );

  const todo = stationOrders.filter((order) => order.items.some((item) => item.status === 'new'));
  const cooking = stationOrders.filter((order) => order.items.some((item) => item.status === 'cooking') && !order.items.some((item) => item.status === 'new'));
  const finishedToday = orders.filter((order) => ['delivered', 'completed'].includes(order.status)).length;

  const act = async (item, action) => {
    setBusy(item.id + action);
    try {
      await api.post(`/order-items/${item.id}/${action}`);
      await loadOrders();
      if (action === 'done') toast(`${item.name} ready — the cashier can call the waiter.`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const suggestion = (name) => menu.items.find((item) => item.name.toLowerCase().includes(String(name).toLowerCase().split(' ')[0]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{STATIONS[station].label} · live tickets</div>
          <h1>{STATIONS[station].label}</h1>
          <p className="page-desc">
            Only your items appear here. Tap <strong>Accept</strong> when you start, <strong>Done</strong> when the plate or cup leaves your hands.
            The cashier sees “send waiter” as soon as every item on an order is done.
          </p>
        </div>
        <div className="row">
          {user.role === 'admin' || user.role === 'manager' ? (
            <Seg
              value={station}
              onChange={setStation}
              options={Object.values(STATIONS).map((item) => ({ value: item.key, label: item.label }))}
            />
          ) : null}
          <button className="btn" onClick={loadOrders}>
            <Icon name="rotate-ccw" size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Waiting to start" value={todo.length} icon="clock" alert={todo.length > 0} foot="Accept a ticket to show you started it" />
        <Stat label="On the fire" value={cooking.length} icon="hot" foot="Accepted, not finished" />
        <Stat label="Finished this shift" value={finishedToday} icon="check-circle" foot="Handed to the waiter" />
      </div>

      {stationOrders.length === 0 ? (
        <Empty
          title="No tickets for you right now"
          hint="When the cashier sends an order to your station it appears here instantly, with a sound."
          icon={STATIONS[station].icon}
        />
      ) : (
        <div className="grid grid-3">
          {[...todo, ...cooking.filter((order) => !todo.includes(order))].map((order) => {
            const doneCount = order.items.filter((item) => item.status === 'done').length;
            return (
              <section className="station-ticket" key={order.id}>
                <header>
                  <div>
                    <div className="code">#{order.code}</div>
                    <div className="tiny" style={{ color: '#9fc4bb', marginTop: 3 }}>
                      {order.room_id ? `Room ${order.room_number}` : 'Counter'} · {order.guest_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {order.status === 'ready' ? (
                      <span className="pill completed"><i />All done</span>
                    ) : (
                      <span className="tiny" style={{ color: '#9fc4bb' }}>
                        {doneCount}/{order.items.length} done
                      </span>
                    )}
                    <div className="tiny" style={{ color: '#9fc4bb', marginTop: 4 }}>
                      {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </header>
                {order.note ? (
                  <div style={{ padding: '10px 16px', background: 'var(--amber-soft)', fontSize: 12, color: '#7a571c' }}>
                    <Icon name="alert" size={12} /> {order.note}
                  </div>
                ) : null}
                {order.items.map((item) => {
                  const suggested = suggestion(item.name);
                  return (
                    <div className={`item ${item.status === 'done' ? 'done' : item.status === 'cooking' ? 'cooking' : ''}`} key={item.id}>
                      <div className="qty">{item.qty}</div>
                      <div className="name">
                        {suggested?.emoji ? `${suggested.emoji} ` : ''}
                        {item.name}
                        {item.note ? <div className="tiny muted">{item.note}</div> : null}
                      </div>
                      {item.status === 'done' ? (
                        <span className="pill completed"><i />Done</span>
                      ) : item.status === 'cooking' ? (
                        <button className="btn btn-sm btn-primary" disabled={busy === item.id + 'done'} onClick={() => act(item, 'done')}>
                          <Icon name="check" size={14} /> Done
                        </button>
                      ) : (
                        <button className="btn btn-sm" disabled={busy === item.id + 'accept'} onClick={() => act(item, 'accept')}>
                          Accept
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <div style={{ height: 18 }} />
      <div className="banner info">
        <Icon name="wifi" size={15} />
        <span>
          Keep this screen open on the tablet in your station — tickets and alerts arrive by themselves, no refresh needed.
          {user.role === 'admin' || user.role === 'manager' ? ' ' : ''}
        </span>
      </div>
    </>
  );
}
