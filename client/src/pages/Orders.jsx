import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { Stat, Empty, Card } from '../lib/ui.jsx';
import { OrderTicket, NewOrderModal, OrderDetailModal } from '../components/OrderPieces.jsx';
import { STATIONS } from '../../../shared/billing.js';

const COLUMNS = [
  { key: 'new', title: '1 · New — accept it', hint: 'Just arrived from a room or the till' },
  { key: 'accepted', title: '2 · Call the guest, then send', hint: 'Tell the guest how long it will take' },
  { key: 'sent', title: '3 · In the stations', hint: 'Kitchen · barista · juice are working' },
  { key: 'ready', title: '4 · Ready — send the waiter', hint: 'Everything is cooked and plated' },
  { key: 'delivering', title: '5 · On the way', hint: 'Waiter is taking it to the room' },
  { key: 'delivered', title: '6 · Delivered — close it', hint: 'Already on the guest bill' },
];

export default function Orders() {
  const { orders, toast, loadOrders, settings } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [busy, setBusy] = useState('');
  const [stationFilter, setStationFilter] = useState('all');

  const grouped = useMemo(() => {
    const map = {};
    COLUMNS.forEach((column) => {
      map[column.key] = orders.filter((order) => order.status === column.key);
    });
    map.completed = orders.filter((order) => order.status === 'completed').slice(0, 8);
    return map;
  }, [orders]);

  const act = async (order, action, body) => {
    setBusy(order.id + action);
    try {
      if (action === 'accept') {
        await api.post(`/orders/${order.id}/accept`, { call_confirmed: body?.call_confirmed ?? false });
        toast(`Order #${order.code} accepted${body?.call_confirmed ? ' and confirmed by phone' : ''}.`);
      }
      if (action === 'send') {
        await api.post(`/orders/${order.id}/send`);
        toast(`Order #${order.code} sent — the stations have it now.`);
      }
      if (action === 'confirm') {
        await api.post(`/orders/${order.id}/confirm-call`);
        toast(`Order #${order.code} marked as confirmed with the guest.`);
      }
      if (action === 'waiter') {
        await api.post(`/orders/${order.id}/send-waiter`);
        toast(`Waiter asked to take order #${order.code} to Room ${order.room_number}.`);
      }
      if (action === 'close') {
        await api.post(`/orders/${order.id}/close`, { paid_method: body?.paid_method });
        toast(`Order #${order.code} closed.`);
      }
      if (action === 'cancel') {
        await api.post(`/orders/${order.id}/cancel`, { reason: body?.reason || 'Cancelled at the desk' });
        toast(`Order #${order.code} cancelled.`, 'info');
      }
      await loadOrders();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const visibleOrders = (list) =>
    stationFilter === 'all'
      ? list
      : list.filter((order) => order.items.some((item) => item.station === stationFilter));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Every order, every stage</div>
          <h1>Orders desk</h1>
          <p className="page-desc">
            QR orders arrive here with a full-screen ring. Accept → call the guest → send to the stations. When the stations finish, the
            waiter button lights up — and the money is added to the room bill the moment it is delivered.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => loadOrders()}>
            <Icon name="rotate-ccw" size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={15} /> New order
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Waiting to be accepted" value={grouped.new.length} icon="bell" alert={grouped.new.length > 0} foot="Guests are waiting at the phone" />
        <Stat label="In the stations" value={grouped.sent.length} icon="chef-hat" foot={`${grouped.accepted.length} to send`} />
        <Stat label="Ready to deliver" value={grouped.ready.length} icon="check-circle" alert={grouped.ready.length > 0} foot="Send the waiter" />
        <Stat label="On the way" value={grouped.delivering.length} icon="send" foot={`${grouped.delivered.length} delivered, waiting to be closed`} />
      </div>

      <Card
        title="Filter by station"
        subtitle="See only the tickets that touch one department"
        className="no-print"
      >
        <div className="chips">
          <button className={`chip ${stationFilter === 'all' ? 'on' : ''}`} onClick={() => setStationFilter('all')}>All stations</button>
          {Object.values(STATIONS).filter((station) => station.key !== 'bar').map((station) => (
            <button key={station.key} className={`chip ${stationFilter === station.key ? 'on' : ''}`} onClick={() => setStationFilter(station.key)}>
              <Icon name={station.icon} size={12} /> {station.label}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <div className="kanban">
        {COLUMNS.map((column) => {
          const list = visibleOrders(grouped[column.key] || []);
          return (
            <div className="column" key={column.key}>
              <h4>
                <span>{column.title}</span>
                <span>{list.length}</span>
              </h4>
              <div className="tiny muted" style={{ margin: '-8px 6px 10px' }}>{column.hint}</div>
              {list.length === 0 ? <div className="tiny muted" style={{ padding: '10px 6px' }}>Nothing here right now.</div> : null}
              {list.map((order) => (
                <OrderTicket key={order.id} order={order} onOpen={() => setDetailId(order.id)}>
                  {order.status === 'new' ? (
                    <>
                      <button className="btn btn-sm btn-primary" disabled={busy === order.id + 'accept'} onClick={() => act(order, 'accept', { call_confirmed: true })}>
                        <Icon name="check" size={13} /> Accept · called
                      </button>
                      <button className="btn btn-sm" onClick={() => act(order, 'accept', { call_confirmed: false })}>Accept only</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => act(order, 'cancel', { reason: 'Declined at the desk' })}>Decline</button>
                    </>
                  ) : null}

                  {order.status === 'accepted' ? (
                    <>
                      <button className="btn btn-sm btn-primary" disabled={busy === order.id + 'send'} onClick={() => act(order, 'send')}>
                        <Icon name="send" size={13} /> Send to stations
                      </button>
                      {!order.call_confirmed ? (
                        <button className="btn btn-sm" onClick={() => act(order, 'confirm')}>
                          <Icon name="phone" size={13} /> Mark as called
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {order.status === 'sent' ? (
                    <div className="tiny muted">
                      {order.items.filter((item) => item.status === 'done').length}/{order.items.length} item(s) finished ·{' '}
                      {order.stations.map((station) => STATIONS[station]?.label || station).join(', ')}
                    </div>
                  ) : null}

                  {order.status === 'ready' ? (
                    <button className="btn btn-sm btn-primary" disabled={busy === order.id + 'waiter'} onClick={() => act(order, 'waiter')}>
                      <Icon name="send" size={13} /> Send waiter to Room {order.room_number}
                    </button>
                  ) : null}

                  {order.status === 'delivering' ? (
                    <div className="tiny muted">With the waiter · {order.charged ? 'already on the bill' : 'will be charged on delivery'}</div>
                  ) : null}

                  {order.status === 'delivered' ? (
                    <>
                      <button className="btn btn-sm btn-primary" disabled={busy === order.id + 'close'} onClick={() => act(order, 'close')}>
                        <Icon name="check" size={13} /> Done · close order
                      </button>
                      <span className="tiny muted row tight">
                        <Icon name={order.charged ? 'receipt' : 'alert'} size={12} /> {order.charged ? 'On the guest bill' : 'Not charged'}
                      </span>
                    </>
                  ) : null}
                </OrderTicket>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ height: 18 }} />
      <Card title="Completed today" subtitle="Closed orders stay visible for the shift">
        {grouped.completed.length === 0 ? (
          <Empty title="No completed orders yet" hint="Finished orders appear here with their total." icon="receipt" />
        ) : (
          <div className="grid grid-2" style={{ gap: 10 }}>
            {grouped.completed.map((order) => (
              <div className="row" key={order.id} style={{ justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 11, background: '#fff' }}>
                <div>
                  <strong className="small">#{order.code} · {order.room_id ? `Room ${order.room_number}` : 'Counter'}</strong>
                  <div className="tiny muted">{order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}</div>
                </div>
                <div className="row tight">
                  <strong className="small">{money(order.total)}</strong>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDetailId(order.id)}><Icon name="eye" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showNew ? <NewOrderModal onClose={() => setShowNew(false)} /> : null}
      {detailId ? <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} /> : null}

      {settings.require_call_confirmation ? (
        <div className="banner info" style={{ marginTop: 16 }}>
          <Icon name="phone" size={15} />
          <span>
            Your hotel asks the desk to <strong>call and confirm</strong> every order before it goes to the kitchen — this reduces wasted food.
            You can change that in Hotel settings.
          </span>
        </div>
      ) : null}
    </>
  );
}
