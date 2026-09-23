import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';
import { Modal, Field, Empty, Pill } from '../lib/ui.jsx';
import { useApp } from '../lib/store.jsx';
import { STATIONS } from '../../../shared/billing.js';

/** Big, plain-language ticket used on the cashier desk, waiter board and stations. */
export function OrderTicket({ order, children, onOpen }) {
  const late = order.ageMs > 20 * 60 * 1000;
  return (
    <article className={`ticket ${order.status === 'new' ? 'new-order' : ''} ${order.status === 'ready' ? 'ready' : ''}`}>
      <div className="top">
        <div>
          <div className="code">#{order.code}</div>
          <div className="tiny muted" style={{ marginTop: 3 }}>
            {order.room_id ? `Room ${order.room_number}` : 'Counter'} · {order.guest_name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Pill status={order.status}>{order.statusLabel}</Pill>
          <div className={`age ${late ? 'late' : ''}`} style={{ marginTop: 6 }}>
            {Math.max(0, Math.round(order.ageMs / 60000))} min
          </div>
        </div>
      </div>
      <ul className="items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              <strong>{item.qty}×</strong> {item.name}
              {item.note ? <em className="tiny muted"> · {item.note}</em> : null}
            </span>
            <span className="tiny muted">
              {STATIONS[item.station]?.label || item.station}
              {item.status === 'done' ? ' ✓' : item.status === 'cooking' ? ' …' : ''}
            </span>
          </li>
        ))}
      </ul>
      {order.note ? (
        <div className="note">
          <Icon name="alert" size={12} /> {order.note}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <strong>{money(order.total)}</strong>
        {order.call_confirmed ? (
          <span className="tiny muted"><Icon name="check" size={11} /> called &amp; confirmed</span>
        ) : null}
      </div>
      {children ? <div className="actions">{children}</div> : null}
      {onOpen ? (
        <button className="table-link" style={{ marginTop: 10 }} onClick={() => onOpen(order)}>
          Open order detail
        </button>
      ) : null}
    </article>
  );
}

/** Menu picker used by the cashier for phone orders, walk-ins and QR-menu orders. */
export function MenuPicker({ value, onChange }) {
  const { menu } = useApp();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menu.items
      .filter((item) => item.available)
      .filter((item) => (category === 'all' ? true : item.category_id === category))
      .filter((item) => (term ? item.name.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term) : true));
  }, [menu.items, category, search]);

  const add = (item) => {
    const existing = value.find((line) => line.menu_item_id === item.id);
    if (existing) onChange(value.map((line) => (line.menu_item_id === item.id ? { ...line, qty: line.qty + 1 } : line)));
    else onChange([...value, { menu_item_id: item.id, name: item.name, price: item.price, station: item.station, qty: 1 }]);
  };

  const setQty = (id, qty) => {
    if (qty <= 0) onChange(value.filter((line) => line.menu_item_id !== id));
    else onChange(value.map((line) => (line.menu_item_id === id ? { ...line, qty } : line)));
  };

  return (
    <div className="grid grid-side" style={{ gap: 16 }}>
      <div>
        <div className="search" style={{ width: '100%', marginBottom: 10 }}>
          <Icon name="search" size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the menu…" />
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button type="button" className={`chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategory('all')}>Everything</button>
          {menu.categories.map((cat) => (
            <button type="button" key={cat.id} className={`chip ${category === cat.id ? 'on' : ''}`} onClick={() => setCategory(cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 12, background: '#fff', padding: '4px 12px' }}>
          {items.length === 0 ? <Empty title="Nothing matches" hint="Try another word or category." icon="utensils" /> : null}
          {items.map((item) => (
            <div className="menu-item" key={item.id}>
              <div className="emoji">{item.emoji || '🍽️'}</div>
              <div className="info">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                <span className="tiny muted" style={{ marginTop: 4 }}>
                  <Icon name={STATIONS[item.station]?.icon || 'utensils'} size={11} /> {STATIONS[item.station]?.label || item.station}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="price">{money(item.price)}</div>
                <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => add(item)}>
                  <Icon name="plus" size={12} /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Order list</h3>
            <div className="sub">{value.reduce((sum, line) => sum + line.qty, 0)} item(s)</div>
          </div>
          {value.length ? (
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => onChange([])}>
              <Icon name="trash" size={13} /> Clear
            </button>
          ) : null}
        </div>
        <div className="card-body" style={{ paddingTop: 6 }}>
          {value.length === 0 ? (
            <Empty title="Nothing yet" hint="Tap Add on the left to build the order." icon="receipt" />
          ) : (
            value.map((line) => (
              <div className="row" key={line.menu_item_id} style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f2f6f5' }}>
                <div style={{ minWidth: 0 }}>
                  <strong className="small">{line.name}</strong>
                  <div className="tiny muted">{money(line.price)} each</div>
                </div>
                <div className="row tight">
                  <div className="qty">
                    <button type="button" onClick={() => setQty(line.menu_item_id, line.qty - 1)}>−</button>
                    <span>{line.qty}</span>
                    <button type="button" onClick={() => setQty(line.menu_item_id, line.qty + 1)}>+</button>
                  </div>
                  <strong className="small" style={{ width: 64, textAlign: 'right' }}>{money(line.price * line.qty)}</strong>
                </div>
              </div>
            ))
          )}
          <div className="bill-total" style={{ marginTop: 12, borderRadius: 10 }}>
            <span>Total</span>
            <span>{money(value.reduce((sum, line) => sum + line.price * line.qty, 0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cashier: take an order for a room, or a walk-in order paid at the till. */
export function NewOrderModal({ defaultRoomId, defaultChannel = 'outdoor', onClose, onDone }) {
  const { rooms, toast, loadOrders } = useApp();
  const [channel, setChannel] = useState(defaultChannel);
  const [roomId, setRoomId] = useState(defaultRoomId || '');
  const [guestName, setGuestName] = useState('Walk-in guest');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);

  const occupied = rooms.filter((room) => room.stay);
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  const submit = async () => {
    if (!lines.length) return toast('Add at least one item to the order.', 'error');
    if (channel !== 'counter' && !roomId) return toast('Choose the room this order is for.', 'error');
    setBusy(true);
    try {
      const result = await api.post('/orders', {
        channel,
        room_id: roomId || null,
        guest_name: channel === 'counter' ? guestName : undefined,
        note,
        items: lines.map((line) => ({ menu_item_id: line.menu_item_id, qty: line.qty })),
      });
      toast(`Order #${result.order.code} is in the queue — accept it, then send it to the stations.`);
      await loadOrders();
      onDone?.(result.order);
      onClose();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New order"
      subtitle="A guest phoned the desk, or a walk-in is ordering at the till — same menu, same stations."
      onClose={onClose}
      size="xwide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            <Icon name="send" size={14} /> Send to the desk queue
          </button>
        </>
      }
    >
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Field label="Who is it for?">
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="outdoor">Room service (guest called)</option>
            <option value="counter">Walk-in / table at the till</option>
          </select>
        </Field>
        <Field label={channel === 'counter' ? 'Table or room (optional)' : 'Room'} required={channel !== 'counter'}>
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            <option value="">Choose…</option>
            {channel === 'counter'
              ? rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.number} {room.stay ? `· ${room.stay.guest}` : '· free'}
                  </option>
                ))
              : occupied.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.number} · {room.stay.guest}
                  </option>
                ))}
          </select>
        </Field>
        {channel === 'counter' ? (
          <Field label="Guest / table name">
            <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Walk-in guest or table number" />
          </Field>
        ) : null}
        <Field label="Note for the kitchen" hint="Allergies, no pepper, extra injera…">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
        </Field>
      </div>

      <MenuPicker value={lines} onChange={setLines} />

      <div className="banner info" style={{ marginTop: 14 }}>
        <Icon name="clock" size={15} />
        <span>
          Then: <strong>accept</strong> the order, <strong>call the guest to confirm</strong>, and <strong>send it to the stations</strong> —
          kitchen, barista and juice only see their own items. {money(total)} so far.
        </span>
      </div>
    </Modal>
  );
}

/** Order detail with the full trail — for answering “where is my food?”. */
export function OrderDetailModal({ orderId, onClose }) {
  const { toast } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(setData).catch((error) => toast(error.message, 'error'));
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const { order, events } = data;

  return (
    <Modal
      title={`Order #${order.code}`}
      subtitle={`${order.room_id ? `Room ${order.room_number}` : 'Counter'} · ${order.guest_name}`}
      onClose={onClose}
      size="wide"
    >
      <div className="grid grid-2" style={{ gap: 18 }}>
        <div>
          <h3 style={{ marginBottom: 10 }}>Items</h3>
          <div className="bill">
            {order.items.map((item) => (
              <div className="bill-line" key={item.id}>
                <div className="desc">
                  {item.qty}× {item.name}
                  <small>
                    {STATIONS[item.station]?.label || item.station} · {item.status}
                  </small>
                </div>
                <strong>{money(item.amount)}</strong>
              </div>
            ))}
            <div className="bill-total">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </div>
          </div>
          {order.note ? (
            <div className="banner warn" style={{ marginTop: 12 }}>
              <Icon name="alert" size={15} />
              <span>{order.note}</span>
            </div>
          ) : null}
          <div className="banner info" style={{ marginTop: 12 }}>
            <Icon name="receipt" size={15} />
            <span>{order.charged ? 'This order is on the guest bill.' : 'Not on the bill yet — it is added the moment the waiter delivers it.'}</span>
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 10 }}>Trail</h3>
          <div className="stack">
            {events.map((event) => (
              <div className="row" key={event.id} style={{ alignItems: 'flex-start', gap: 10 }}>
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}><Icon name="check" size={12} /></div>
                <div>
                  <div className="small"><strong>{event.detail}</strong></div>
                  <div className="tiny muted">
                    {event.actor} · {new Date(event.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
