import { useEffect, useMemo, useRef, useState } from 'react';
import { api, clientRef, fileToDataUrl, mediaUrl } from '../lib/api.js';
import { useApp, useNow, useTopic } from '../lib/store.jsx';
import { computeRoomCharge, BILLING_MODES } from '../../../shared/billing.js';
import { money, formatElapsed, formatCountdown, initials, dateTimeOf, toLocalInput, fromLocalInput, relative } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';
import { Modal, Drawer, Field, Pill, Empty, Stat } from '../lib/ui.jsx';
import { NewOrderModal, OrderDetailModal } from '../components/OrderPieces.jsx';
import CurrencyPicker from '../components/CurrencyPicker.jsx';
import { ReceiptModal } from '../components/Receipt.jsx';

const TILE = {
  available: 'free',
  inspected: 'inspected',
  occupied: 'busy',
  reserved: 'reserved',
  cleaning: 'working', // blue · housekeeping is inside
  dirty: 'needs-clean', // purple · waiting for housekeeping
  maintenance: 'blocked',
  out_of_order: 'blocked',
};

export const STATUS_TEXT = {
  available: 'Free',
  inspected: 'Inspected',
  occupied: 'Occupied',
  reserved: 'Reserved',
  cleaning: 'Cleaning now',
  dirty: 'Needs cleaning',
  maintenance: 'Maintenance',
  out_of_order: 'Out of order',
};

const shortStatus = (status) => STATUS_TEXT[status] || status;
const CLEANING_STATUSES = ['dirty', 'cleaning'];

export default function Rooms() {
  const { rooms, requests, settings, loadRooms } = useApp();
  const [filter, setFilter] = useState('all');
  const [floor, setFloor] = useState('all');
  const [term, setTerm] = useState('');
  const [openRoomId, setOpenRoomId] = useState(null);
  const [checkinRoomId, setCheckinRoomId] = useState(null);
  const [orderRoomId, setOrderRoomId] = useState(null);
  const [showOrder, setShowOrder] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState(null);
  const now = useNow(1000);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    const onSearch = (event) => {
      setTerm(event.detail);
      setFilter('all');
      const match = rooms.find((room) => room.number.includes(event.detail) || room.stay?.guest?.toLowerCase().includes(event.detail));
      if (match) setOpenRoomId(match.id);
    };
    window.addEventListener('clove:search', onSearch);
    return () => window.removeEventListener('clove:search', onSearch);
  }, [rooms]);

  const counts = useMemo(() => ({
    free: rooms.filter((room) => ['available', 'inspected'].includes(room.status)).length,
    busy: rooms.filter((room) => room.status === 'occupied').length,
    service: rooms.filter((room) => CLEANING_STATUSES.includes(room.status)).length,
    dirty: rooms.filter((room) => room.status === 'dirty').length,
    blocked: rooms.filter((room) => ['maintenance', 'out_of_order'].includes(room.status)).length,
    reserved: rooms.filter((room) => room.status === 'reserved').length,
  }), [rooms]);
  const toClean = rooms.filter((room) => CLEANING_STATUSES.includes(room.status));

  const floors = [...new Set(rooms.map((room) => room.floor))].sort();

  const visible = rooms.filter((room) => {
    if (floor !== 'all' && room.floor !== Number(floor)) return false;
    if (term) {
      const needle = term.toLowerCase();
      const haystack = `${room.number} ${room.type?.name || ''} ${room.stay?.guest || ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    switch (filter) {
      case 'free': return ['available', 'inspected'].includes(room.status);
      case 'busy': return room.status === 'occupied';
      case 'service': return CLEANING_STATUSES.includes(room.status);
      case 'blocked': return ['maintenance', 'out_of_order'].includes(room.status);
      case 'reserved': return room.status === 'reserved';
      default: return true;
    }
  });

  const openRoom = rooms.find((room) => room.id === openRoomId) || null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Front desk · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Room board</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setShowOrder(true)}>
            <Icon name="phone" size={14} /> Phone / walk-in order
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const free = rooms.find((room) => ['available', 'inspected'].includes(room.status));
              if (free) setCheckinRoomId(free.id);
            }}
          >
            <Icon name="user-plus" size={15} /> Check a guest in
          </button>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 18 }}>
        <Stat label="Free rooms" value={counts.free} unit={`/ ${rooms.length}`} icon="door" foot={`${counts.busy} occupied · ${counts.reserved} reserved`} />
        <Stat label="Waiting to be cleaned" value={counts.service} icon="broom" alert={counts.dirty > 0} foot={counts.service ? `${counts.dirty} not started yet` : 'Every room is clean'} />
        <Stat label="Occupied now" value={counts.busy} icon="users" foot={`${counts.service} room(s) to clean`} alert={counts.busy > counts.free} />
        <Stat label="Awaiting registration" value={requests.length} icon="clipboard" foot={requests.length ? 'Guest filled the form from the QR code' : 'No requests waiting'} alert={requests.length > 0} />
        <Stat
          label="Open bills (in-house)"
          value={money(rooms.reduce((sum, room) => sum + (room.totals?.balance || 0), 0))}
          icon="receipt"
          foot="Charged to guests still in the hotel"
        />
      </div>

      {toClean.length ? <CleaningQueue rooms={toClean} onDone={loadRooms} /> : null}

      {requests.length ? <PendingRegistrations requests={requests} rooms={rooms} onDone={loadRooms} /> : null}

      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="board-bar" style={{ marginBottom: 0 }}>
          <div className="chips">
            {[
              ['all', `All rooms (${rooms.length})`],
              ['free', `Free (${counts.free})`],
              ['busy', `Occupied (${counts.busy})`],
              ['service', `To clean (${counts.service})`],
              ['blocked', `Blocked (${counts.blocked})`],
            ].map(([key, label]) => (
              <button key={key} className={`chip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <div className="chips">
            <button className={`chip ${floor === 'all' ? 'on' : ''}`} onClick={() => setFloor('all')}>All floors</button>
            {floors.map((item) => (
              <button key={item} className={`chip ${floor === String(item) ? 'on' : ''}`} onClick={() => setFloor(String(item))}>
                Floor {item}
              </button>
            ))}
          </div>
          {term ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setTerm('')}>
              <Icon name="x" size={13} /> {term}
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty title="No rooms match this filter" hint="Try another floor or clear the filters." icon="door" />
      ) : (
        <div className="room-grid">
          {visible.map((room) => {
            const live = room.stay ? computeRoomCharge(room.stay, now) : null;
            return (
              <button key={room.id} className={`room-tile ${TILE[room.status] || ''}`} onClick={() => setOpenRoomId(room.id)}>
                <span className="flag stack">
                  {requests.some((request) => request.room_id === room.id) ? (
                    <Pill status="new" className="tile-note">form</Pill>
                  ) : null}
                  <Pill status={room.status}>{shortStatus(room.status)}</Pill>
                </span>
                <div className="num">{room.number}</div>
                <div className="type">{room.type?.name}{room.billing_mode === 'dayuse' ? ' · day use' : room.billing_mode === 'hourly' ? ' · hourly' : ''}</div>
                {room.stay ? (
                  <>
                    <div className="guest">{room.stay.guest}</div>
                    <div className="meta">
                      <span><Icon name="clock" size={11} /> {formatElapsed(live.elapsedMs)}</span>
                      <span className="bill">{money(room.totals.balance)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="guest muted">{money(room.type?.nightly_rate)} <span className="tiny">/ night</span></div>
                    <div className="meta">
                      <span>{room.type?.beds}</span>
                      <span>{room.type?.max_guests} guest(s)</span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      <OpenOrdersStrip onOpen={(id) => setDetailOrderId(id)} />

      {detailOrderId ? <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} /> : null}

      {openRoom ? (
        <RoomDrawer
          room={openRoom}
          onClose={() => setOpenRoomId(null)}
          onCheckIn={() => setCheckinRoomId(openRoom.id)}
          onNewOrder={() => {
            setOrderRoomId(openRoom.id);
            setShowOrder(true);
          }}
        />
      ) : null}

      {checkinRoomId ? (
        <CheckInModal
          roomId={checkinRoomId}
          onClose={() => setCheckinRoomId(null)}
          onDone={() => {
            setCheckinRoomId(null);
            loadRooms();
          }}
        />
      ) : null}

      {showOrder ? (
        <NewOrderModal
          defaultRoomId={orderRoomId || openRoomId || ''}
          onClose={() => {
            setShowOrder(false);
            setOrderRoomId(null);
          }}
        />
      ) : null}
    </>
  );
}

/* -------------------------- live orders under the board ------------------- */
/**
 * Every order the desk has not closed yet, one card each — labeled by where it
 * was sent from (Table 3, Room 105, Counter). The next step in the flow is one
 * tap away; Print opens the receipt slip for the order printer.
 */
function OpenOrdersStrip({ onOpen }) {
  const { orders, toast, loadOrders, settings } = useApp();
  const [busy, setBusy] = useState('');
  const [printOrder, setPrintOrder] = useState(null);

  if (settings.hide_dashboard_orders) return null;

  const open = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));

  const act = async (order, action) => {
    setBusy(order.id + action);
    try {
      const paths = {
        accept: `/orders/${order.id}/accept`,
        ready: `/orders/${order.id}/ready`,
        deliver: `/orders/${order.id}/deliver`,
        close: `/orders/${order.id}/close`,
      };
      await api.post(paths[action], action === 'close' ? { paid_method: 'cash' } : {});
      await loadOrders();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const nextStep = (order) => {
    switch (order.status) {
      case 'new': return ['accept', 'Accept'];
      case 'accepted': return ['ready', 'Food is up'];
      case 'sent': return ['ready', 'Food is up'];
      case 'ready': return ['deliver', order.table_name ? 'Serve the table' : 'Deliver'];
      case 'delivering': return ['deliver', 'Handed over'];
      case 'delivered': return ['close', 'Close & collect'];
      default: return null;
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Live orders</h3>
        <span className="muted small">{open.length} open</span>
      </div>
      {open.length === 0 ? (
        <Empty title="No open orders" icon="receipt" />
      ) : (
        <div className="grid grid-4">
          {open.map((order) => {
            const step = nextStep(order);
            return (
              <div className="order-card" key={order.id}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <button className="order-place" onClick={() => onOpen(order.id)}>
                    {order.table_name ? order.table_name : order.room_id ? `Room ${order.room_number}` : 'Counter'}
                  </button>
                  <Pill status={order.status}>{order.status}</Pill>
                </div>
                <div className="tiny muted">#{order.code} · {order.items.length} item(s)</div>
                <div className="small" style={{ margin: '6px 0' }}>
                  {order.items.slice(0, 3).map((item) => `${item.qty}× ${item.name}`).join(' · ')}
                  {order.items.length > 3 ? '…' : ''}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{money(order.total)}</strong>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => setPrintOrder(order)} title="Print receipt">
                      <Icon name="print" size={13} />
                    </button>
                    {step ? (
                      <button
                        className={`btn btn-sm ${step[0] === 'accept' || step[0] === 'close' ? 'btn-primary' : ''}`}
                        disabled={busy === order.id + step[0]}
                        onClick={() => act(order, step[0])}
                      >
                        {step[1]}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {printOrder ? (
        <ReceiptModal order={printOrder} title={`Receipt · #${printOrder.code}`} onClose={() => setPrintOrder(null)} />
      ) : null}
    </div>
  );
}

/* ------------------------------- the room -------------------------------- */

function RoomDrawer({ room: roomSummary, onClose, onCheckIn, onNewOrder }) {
  const { toast, requests, loadRooms, loadRequests, settings, user } = useApp();
  const [detail, setDetail] = useState(null);
  const [photo, setPhoto] = useState(0);
  const [modal, setModal] = useState(null); // 'payment' | 'charge' | 'checkout' | 'extend' | 'receipt' | 'outdoor'
  const now = useNow(1000);

  const room = detail?.room || roomSummary;
  const folio = detail?.folio || null;
  const stay = room.stay;
  const live = stay ? computeRoomCharge(folio || stay, now) : null;
  const totals = folio?.totals || room.totals;
  // Room money reads in the guest's currency; everything else is birr.
  const gcur = folio?.currency || 'ETB';
  const gfx = Number(folio?.fx_rate) || 1;
  const guestMoney = (value) => (gcur !== 'ETB' && gfx
    ? `${(Number(value || 0) / gfx).toFixed(2)} ${gcur}`
    : money(value));
  const pendingRequest = requests.find((request) => request.room_id === room.id);

  const load = async () => {
    try {
      setDetail(await api.get(`/rooms/${room.id}`));
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  useEffect(() => {
    load();
  }, [room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useTopic('folios', load);
  useTopic('rooms', load);
  useTopic('orders', load);

  const photos = room.type?.photos?.length ? room.type.photos : [];
  const setStatus = async (status) => {
    try {
      await api.post(`/rooms/${room.id}/status`, { status });
      toast(`Room ${room.number} marked as ${shortStatus(status).toLowerCase()}.`);
      load();
      loadRooms();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <Drawer
      wide
      onClose={onClose}
      title={`Room ${room.number}`}
      subtitle={`${room.type?.name} · ${room.type?.beds} · up to ${room.type?.max_guests} guest(s) · Floor ${room.floor}`}
    >
      {photos.length ? (
        <div>
          <div className="gallery">
            <img src={photos[Math.min(photo, photos.length - 1)]} alt={`Room ${room.number}`} />
          </div>
          {photos.length > 1 ? (
            <div className="thumbs">
              {photos.map((src, index) => (
                <button key={src} className={index === photo ? 'active' : ''} onClick={() => setPhoto(index)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="gallery">
          <div className="empty">No photos yet — an admin can add them in Rooms &amp; photos.</div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Pill status={room.status}>{shortStatus(room.status)}</Pill>
        <div className="row tight">
          {room.type?.nightly_rate ? <span className="chip"><Icon name="moon" size={12} /> {money(room.type.nightly_rate)} / night</span> : null}
          {room.type?.hourly_rate ? <span className="chip"><Icon name="clock" size={12} /> {money(room.type.hourly_rate)} / hour</span> : null}
          {room.type?.dayuse_rate ? <span className="chip"><Icon name="hot" size={12} /> {money(room.type.dayuse_rate)} / {room.type.dayuse_hours}h day use</span> : null}
        </div>
      </div>

      {room.type?.description ? <p className="small" style={{ color: 'var(--ink-soft)', lineHeight: 1.65 }}>{room.type.description}</p> : null}
      {room.type?.amenities?.length ? (
        <div className="chips">
          {room.type.amenities.map((item) => (
            <span className="chip" key={item}><Icon name="check" size={11} /> {item}</span>
          ))}
        </div>
      ) : null}

      {pendingRequest ? (
        <div className="banner warn">
          <Icon name="clipboard" size={16} />
          <div style={{ flex: 1 }}>
            <strong>{pendingRequest.payload.full_name} filled the guest form from the room QR code.</strong>
            <div className="tiny" style={{ marginTop: 4 }}>
              {[pendingRequest.payload.phone, pendingRequest.payload.id_type, pendingRequest.payload.id_number].filter(Boolean).join(' · ')} ·{' '}
              {Math.max(0, Math.round((Date.now() - new Date(pendingRequest.created_at).getTime()) / 60000))} min ago
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={async () => {
                  try {
                    await api.post(`/checkin-requests/${pendingRequest.id}/approve`, {});
                    toast(`${pendingRequest.payload.full_name} is checked in to Room ${room.number}.`);
                    loadRequests();
                    load();
                    loadRooms();
                  } catch (error) {
                    toast(error.message, 'error');
                  }
                }}
              >
                <Icon name="check" size={13} /> Approve &amp; check in
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await api.post(`/checkin-requests/${pendingRequest.id}/reject`, { reason: 'Declined at the desk' });
                  loadRequests();
                  load();
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stay && live ? (
        <>
          <div className="countdown">
            <div>
              <div className="lbl">Time in the room</div>
              <div className="big">{formatElapsed(live.elapsedMs)}</div>
              <div className="tiny" style={{ color: '#93b6ae', marginTop: 6 }}>
                Checked in {dateTimeOf(folio?.check_in_at)} · planned out {dateTimeOf(folio?.expected_out_at)}
              </div>
            </div>
            <div>
              <div className="lbl">Next {live.unitLabel} starts in</div>
              <div className="big">{live.nextUnitInMs > 0 ? formatCountdown(live.nextUnitInMs) : 'now'}</div>
              <div className="tiny" style={{ color: '#93b6ae', marginTop: 6 }}>
                {BILLING_MODES[live.mode].label} · {money(live.rate)} per {live.unitLabel}
              </div>
            </div>
            <div className="money">
              <div className="lbl">Room charge so far</div>
              <div className="big">{guestMoney(totals?.room)}</div>
              <div className="tiny" style={{ color: '#93b6ae', marginTop: 6 }}>
                {live.billedUnits} {live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural} × {guestMoney(folio?.rate_foreign ?? folio?.rate)} = {guestMoney(totals?.room)}
              </div>
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={() => setModal('outdoor')}>
              <Icon name="utensils" size={14} /> Outdoor
            </button>
            <button className="btn" onClick={() => setModal('charge')}>
              <Icon name="plus" size={14} /> Other service
            </button>
            <button className="btn" onClick={() => setModal('payment')}>
              <Icon name="banknote" size={14} /> Take payment
            </button>
            <button className="btn" onClick={() => setModal('extend')}>
              <Icon name="calendar" size={14} /> Extend stay
            </button>
            <button className="btn" onClick={() => setModal('receipt')}>
              <Icon name="print" size={14} /> Print receipt
            </button>
            <button className="btn btn-dark" onClick={() => setModal('checkout')}>
              <Icon name="log-out" size={14} /> Check out &amp; print
            </button>
          </div>

          <div className="kv">
            <div>
              <div className="k">Guest</div>
              <div className="v">{folio?.guest?.full_name}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{folio?.guest?.phone || 'no phone'}</div>
            </div>
            <div>
              <div className="k">ID</div>
              <div className="v">{folio?.guest?.id_type || '—'}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{folio?.guest?.id_number || ''}</div>
              {folio?.guest?.id_document_url ? (
                <a className="tiny" href={mediaUrl(folio.guest.id_document_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-dark)' }}>
                  document on file
                </a>
              ) : null}
            </div>
            <div>
              <div className="k">Guests</div>
              <div className="v">{folio?.adults} adult(s)</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{folio?.guest?.nationality || ''}</div>
            </div>
            <div>
              <div className="k">Booked</div>
              <div className="v">{folio?.source === 'self' ? 'Self · QR' : 'At the desk'}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>Ref {folio?.code}</div>
            </div>
          </div>

          {Object.entries(folio?.guest?.extra || {}).length ? (
            <div className="kv">
              {Object.entries(folio.guest.extra).map(([key, value]) => (
                <div key={key}>
                  <div className="k">{key.replace(/_/g, ' ')}</div>
                  <div className="v">{String(value)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <BillPanel folio={folio} totals={totals} />

          {detail?.orders?.length ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Orders for this room</h3>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 4 }}>
                {detail.orders.slice(0, 6).map((order) => (
                  <div className="row" key={order.id} style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f2f6f5' }}>
                    <div>
                      <strong className="small">#{order.code} · {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}</strong>
                      <div className="tiny muted">{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {order.channel}</div>
                    </div>
                    <div className="row tight">
                      <span className="pill gray">{order.statusLabel}</span>
                      <strong className="small">{money(order.total)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="row">
            <button className="btn btn-primary btn-lg" onClick={onCheckIn}>
              <Icon name="user-plus" size={16} /> Check this guest in
            </button>
            <button className="btn btn-lg" onClick={onNewOrder}>
              <Icon name="utensils" size={15} /> Order to this room
            </button>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Room status for housekeeping</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="row">
            {['available', 'inspected', 'cleaning', 'dirty', 'maintenance', 'out_of_order'].map((status) => (
              <button
                key={status}
                className={`btn btn-sm ${room.status === status ? 'btn-soft' : ''}`}
                disabled={!!stay && ['available', 'inspected', 'cleaning', 'dirty'].includes(status)}
                onClick={() => setStatus(status)}
                title={!!stay && ['available', 'inspected', 'cleaning', 'dirty'].includes(status) ? 'Guest is still in the room' : ''}
              >
                {shortStatus(status)}
              </button>
            ))}
          </div>
          {['dirty', 'cleaning'].includes(room.status) && !stay ? (
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              onClick={async () => {
                try {
                  await api.post(`/rooms/${room.id}/cleaned`, {});
                  toast(`Room ${room.number} is clean — green again.`);
                  load();
                  loadRooms();
                } catch (error) {
                  toast(error.message, 'error');
                }
              }}
            >
              <Icon name="sparkles" size={15} /> Cleaned
            </button>
          ) : null}
        </div>
      </div>

      {modal === 'payment' ? (
        <PaymentModal
          stayId={folio.id}
          currency={folio.currency}
          fxRate={folio.fx_rate}
          balance={totals?.balance}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); loadRooms(); }}
        />
      ) : null}
      {modal === 'outdoor' ? (
        <NewOrderModal
          chargeNow
          defaultRoomId={room.id}
          defaultChannel="outdoor"
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); loadRooms(); }}
        />
      ) : null}
      {modal === 'charge' ? <ChargeModal stayId={folio.id} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); loadRooms(); }} /> : null}
      {modal === 'extend' ? <ExtendModal folio={folio} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} /> : null}
      {modal === 'receipt' ? <ReceiptModal folio={folio} room={room} onClose={() => setModal(null)} /> : null}
      {modal === 'checkout' ? (
        <CheckoutModal
          folio={folio}
          totals={totals}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            onClose();
            loadRooms();
          }}
        />
      ) : null}
    </Drawer>
  );
}

function BillPanel({ folio, totals }) {
  const items = folio?.items || [];
  const of = (kinds) => items.filter((item) => kinds.includes(item.kind));
  const sum = (list) => list.reduce((total, item) => total + item.amount, 0);
  const live = folio ? computeRoomCharge(folio || {}, new Date()) : null;

  const groups = [
    { key: 'room', label: 'Room', items: of(['room']) },
    { key: 'food', label: 'Food & drinks', items: of(['food']) },
    { key: 'service', label: 'Hotel services', items: of(['service', 'other']) },
    { key: 'discount', label: 'Discounts', items: of(['discount']) },
    { key: 'payment', label: 'Payments received', items: of(['payment']) },
  ].map((group) => ({ ...group, total: sum(group.items) }));

  return (
    <div className="bill">
      <div className="bill-line" style={{ background: '#f8fbfa' }}>
        <div className="desc"><strong>Guest bill · {folio?.code}</strong><small>Everything charged to this room</small></div>
        <strong>{money(totals?.balance)}</strong>
      </div>

      {/* summary line the cashier reads out loud: room for N nights, food, extras */}
      <div className="bill-summary">
        <div>
          <span>Room</span>
          <strong>{money(totals?.room)}</strong>
          <small>{live ? `${live.billedUnits} ${live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural} · ${money(folio?.rate)}` : ''}</small>
        </div>
        <div>
          <span>Food</span>
          <strong>{money(totals?.food)}</strong>
          <small>{of(['food']).length} line(s)</small>
        </div>
        <div>
          <span>Other</span>
          <strong>{money((totals?.service || 0) + (totals?.other || 0))}</strong>
          <small>services &amp; extras</small>
        </div>
        <div>
          <span>Paid</span>
          <strong>{money(totals?.paid)}</strong>
          <small>cash · card · mobile</small>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key}>
          <div className="bill-group-head">
            <span>{group.label}</span>
            <strong>{money(group.total)}</strong>
          </div>
          {group.key === 'room' && group.items.length === 0 ? (
            <div className="bill-line">
              <div className="desc">
                Room charge · counting live
                <small>{folio?.billing_mode} @ {money(folio?.rate)}</small>
              </div>
              <strong>{money(totals?.room)}</strong>
            </div>
          ) : null}
          {group.items.map((item) => (
            <div className={`bill-line ${item.amount < 0 ? 'neg' : ''}`} key={item.id}>
              <div className="desc">
                {item.qty > 1 ? `${item.qty}× ` : ''}{item.description}
                <small>
                  {new Date(item.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {item.method ? ` · ${item.method}` : ''}
                </small>
              </div>
              <strong>{money(item.amount)}</strong>
            </div>
          ))}
        </div>
      ))}

      <div className="bill-line">
        <div className="desc">Total charges</div>
        <strong>{money(totals?.total)}</strong>
      </div>
      <div className="bill-line neg">
        <div className="desc">Paid so far</div>
        <strong>{money(totals?.paid)}</strong>
      </div>
      <div className="bill-total due">
        <span>Balance to collect</span>
        <span>{money(totals?.balance)}</span>
      </div>
    </div>
  );
}

/* ------------------------------- check-in -------------------------------- */

function CheckInModal({ roomId, onClose, onDone }) {
  const { rooms, toast, loadRooms, settings } = useApp();
  const room = rooms.find((item) => item.id === roomId);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [mode, setMode] = useState(room?.billing_mode || 'nightly');
  const [rate, setRate] = useState('');
  const [units, setUnits] = useState(1);
  const [deposit, setDeposit] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // The currency the guest will pay in, frozen with the rate of the day.
  const [currency, setCurrency] = useState('ETB');
  const [rates, setRates] = useState(null);
  // 1 unit of the guest's money in birr — prefilled from the rates, correctable.
  const [manualFx, setManualFx] = useState('');
  const [idPhoto, setIdPhoto] = useState(null); // data URL, uploaded after check-in

  useEffect(() => {
    api
      .get('/fx')
      .then((data) => setRates(data))
      .catch(() => setRates(null));
  }, []);

  useEffect(() => {
    api.get('/registration-fields').then((data) => {
      setFields(data.fields);
      const initial = {};
      data.fields.forEach((field) => {
        initial[field.key] = field.default || '';
      });
      setValues(initial);
    });
  }, []);

  useEffect(() => {
    if (!room) return;
    const type = room.type || {};
    const price = mode === 'hourly' ? type.hourly_rate : mode === 'dayuse' ? type.dayuse_rate : type.nightly_rate;
    const fx = currency === 'ETB' ? 1 : Number(manualFx) || rateFor(currency) || 0;
    // Prefill in the guest's currency; the cashier confirms or rewrites it.
    setRate(currency === 'ETB' || !fx ? String(price || '') : String(Math.round((price / fx) * 100) / 100 || ''));
    setUnits(mode === 'nightly' ? 1 : mode === 'dayuse' ? (type.dayuse_hours || 3) : 1);
  }, [mode, room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching currency swaps the price and the rate of the day into that money.
  useEffect(() => {
    if (!room) return;
    const type = room.type || {};
    const price = mode === 'hourly' ? type.hourly_rate : mode === 'dayuse' ? type.dayuse_rate : type.nightly_rate;
    const fx = currency === 'ETB' ? 1 : rateFor(currency);
    setManualFx(currency === 'ETB' ? '' : fx ? String(fx) : '');
    setRate(currency === 'ETB' || !fx ? String(price || '') : String(Math.round((price / fx) * 100) / 100 || ''));
  }, [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) return null;
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const estimated = (Number(rate) || 0) * Math.max(1, Number(units) || 1);
  const estimatedLabel = currency === 'ETB' ? money(estimated) : `${(estimated || 0).toFixed(2)} ${currency}`;
  const rateFor = (code) => Number(rates?.rates?.[code]) || 0;
  const currencies = Object.keys(rates?.rates || { ETB: 1 });

  const submit = async () => {
    const missing = fields.filter((field) => field.required && !String(values[field.key] || '').trim());
    if (missing.length) return toast(`Please fill in: ${missing.map((field) => field.label).join(', ')}`, 'error');
    setBusy(true);
    try {
      const expected = new Date(Date.now() + (mode === 'nightly' ? 1 : mode === 'dayuse' ? (room.type?.dayuse_hours || 3) : 1) * 3600 * 1000 * Math.max(1, Number(units) || 1));
      const fx = currency === 'ETB' ? 1 : Number(manualFx) || rateFor(currency) || 0;
      const price = Number(rate) || 0;
      const result = await api.post(`/rooms/${room.id}/checkin`, {
        guest: values,
        billing_mode: mode,
        rate: currency === 'ETB' ? (price || undefined) : (price && fx ? price * fx : undefined),
        rateForeign: price || undefined,
        deposit: Number(deposit) || 0,
        method,
        currency,
        fxRate: currency === 'ETB' ? 1 : fx,
        adults: Number(values.adults) || 1,
        expected_out_at: expected.toISOString(),
        note,
      });
      // The identity document belongs to the guest, so it waits for the stay to exist.
      if (idPhoto && result.guestId) {
        try {
          await api.post(`/guests/${result.guestId}/document`, { data_url: idPhoto });
        } catch (error) {
          toast(`Checked in, but the ID photo did not save: ${error.message}`, 'error');
        }
      }
      toast(
        currency === 'ETB'
          ? `${values.full_name} is checked in to Room ${room.number}. The room is now orange and the bill is running.`
          : `${values.full_name} is checked in to Room ${room.number} — the room is billed in ${currency}, food and extras in birr.`,
      );
      loadRooms();
      onDone?.(result);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Check in · Room ${room.number}`}
      subtitle={`${room.type?.name} · ${money(room.type?.nightly_rate)} per night`}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            <Icon name="check" size={15} /> Check in &amp; mark occupied
          </button>
        </>
      }
    >

      <div className="form-grid">
        {fields.map((field) => (
          <Field key={field.id} label={field.label} required={field.required} full={field.type === 'textarea'}>
            {field.type === 'select' ? (
              <select value={values[field.key] || ''} onChange={(event) => set(field.key)(event.target.value)}>
                <option value="">Choose…</option>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                value={values[field.key] || ''}
                placeholder={field.placeholder || ''}
                onChange={(event) => set(field.key)(event.target.value)}
              />
            )}
          </Field>
        ))}
      </div>

      <h3 style={{ margin: '20px 0 10px' }}>Stay &amp; payment</h3>
      <div className="form-grid">
        <Field label="How is this room billed?" hint="Nightly is normal; day use and hourly suit short stays.">
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {Object.values(BILLING_MODES).map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field
          label={mode === 'nightly' ? `Price per night (${currency})` : mode === 'hourly' ? `Price per hour (${currency})` : `Price per day-use block (${currency})`}
          required
        >
          <input type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
        </Field>
        <Field label={mode === 'nightly' ? 'Nights planned' : mode === 'hourly' ? 'Hours planned' : 'Day-use blocks'}>
          <input type="number" min="1" value={units} onChange={(event) => setUnits(event.target.value)} />
        </Field>
        <Field label="Deposit taken now" hint={`Planned room cost ≈ ${estimatedLabel}`}>
          <input type="number" value={deposit} placeholder="0" onChange={(event) => setDeposit(event.target.value)} />
        </Field>
        <Field label="Deposit method">
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {['Cash', 'Card', 'Mobile payment', 'Bank transfer', 'Corporate account'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Desk note">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Allergies, VIP, late checkout…" />
        </Field>
      </div>

      <h3 style={{ margin: '20px 0 10px' }}>Money &amp; identity</h3>
      <div className="form-grid">
        <Field
          label="The guest will pay in"
          hint={currency === 'ETB'
            ? 'Birr — the normal case.'
            : `Room charges print in ${currency}; food and other services print in birr.`}
        >
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </Field>
        {currency !== 'ETB' ? (
          <Field label={`1 ${currency} in birr`} hint="Prefilled from today's rates — correct it if needed.">
            <input type="number" value={manualFx} onChange={(event) => setManualFx(event.target.value)} placeholder="Rate of the day" />
          </Field>
        ) : null}
        <Field label="Today's rates" hint={rates?.source_label || 'No rates loaded'}>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  const fresh = await api.post('/fx/refresh', {});
                  setRates((current) => ({ ...current, ...fresh }));
                  toast(fresh.ok ? `Official rates loaded (${fresh.rates?.USD} birr per dollar).` : `Could not reach the bank — ${fresh.error}`, fresh.ok ? 'success' : 'error');
                } catch (error) {
                  toast(error.message, 'error');
                }
              }}
            >
              <Icon name="rotate-ccw" size={14} /> Get official rates
            </button>
            {currency !== 'ETB' && (Number(manualFx) || rateFor(currency)) ? (
              <span className="small muted">{Number(manualFx) || rateFor(currency)} birr per 1 {currency}</span>
            ) : null}
          </div>
        </Field>
        <Field label="Identity document" full hint="Photograph the passport or kebele ID — it is stored with the guest, not on this device.">
          <div className="row">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (event) => {
                const chosen = event.target.files?.[0];
                if (!chosen) return;
                try {
                  setIdPhoto(await fileToDataUrl(chosen));
                  toast('Photo ready — it is saved when you check the guest in.');
                } catch {
                  toast('That photo could not be read.', 'error');
                }
              }}
            />
            {idPhoto ? (
              <>
                <img src={idPhoto} alt="" style={{ width: 92, height: 62, objectFit: 'cover', borderRadius: 8 }} />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setIdPhoto(null)}>
                  <Icon name="x" size={13} /> Remove
                </button>
              </>
            ) : null}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------- payments -------------------------------- */

export function PaymentModal({ stayId, currency = 'ETB', fxRate = 1, balance = 0, onClose, onDone }) {
  const { toast } = useApp();
  const foreign = currency && currency !== 'ETB' && Number(fxRate) > 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef('');

  // The guest hands over dollars; the folio still keeps birr.
  const given = Number(amount) || 0;
  const etb = foreign ? given * Number(fxRate) : given;

  const submit = async () => {
    setBusy(true);
    if (!ref.current) ref.current = clientRef('payment');
    try {
      const result = await api.post(`/stays/${stayId}/payment`, {
        amount: etb,
        method,
        reference,
        currency: foreign ? currency : undefined,
        fxRate: foreign ? Number(fxRate) : undefined,
        foreignAmount: foreign ? given : undefined,
        client_ref: ref.current,
      });
      ref.current = '';
      toast(
        result.duplicate
          ? 'That payment was already saved.'
          : `${foreign ? `${given} ${currency} (${money(etb)})` : money(etb)} received (${method}).`,
      );
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Take a payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !Number(amount)}>
            <Icon name="banknote" size={15} /> Record payment
          </button>
        </>
      }
    >
      {foreign ? (
        <div className="banner info" style={{ marginBottom: 14 }}>
          <Icon name="exchange" size={15} />
          <span>
            This guest pays in <strong>{currency}</strong> at {fxRate} birr per 1 {currency} (agreed at check-in).
            {balance ? ` Balance: ${(Math.max(0, balance) / Number(fxRate)).toFixed(2)} ${currency}.` : ''}
          </span>
        </div>
      ) : null}
      <div className="form-grid">
        <Field label={foreign ? `Amount received (${currency})` : 'Amount received'} required hint={foreign ? `= ${money(etb)} on the bill` : ''}>
          <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" autoFocus />
        </Field>
        {foreign && balance ? (
          <Field label="Or the whole balance">
            <button className="btn" type="button" onClick={() => setAmount(String((Math.max(0, balance) / Number(fxRate)).toFixed(2)))}>
              {(Math.max(0, balance) / Number(fxRate)).toFixed(2)} {currency}
            </button>
          </Field>
        ) : null}
        <Field label="Method">
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {['Cash', 'Card', 'Mobile payment', 'Bank transfer', 'Corporate account'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference" full hint="Receipt number, transfer id, or the guest's name on a card.">
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}

function ChargeModal({ stayId, onClose, onDone }) {
  const { toast } = useApp();
  const [services, setServices] = useState([]);
  // Rows the cashier builds here: a service (laundry, taxi…) or an item (water, extra bed…).
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/services').then((data) => setServices(data.services || [])).catch(() => setServices([]));
  }, []);

  const addRow = (kind, name = '', price = '') => setRows((current) => [...current, { key: `${Date.now()}-${current.length}`, kind, name, price }]);
  const setRow = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const dropRow = (key) => setRows((current) => current.filter((row) => row.key !== key));

  const save = async () => {
    const ready = rows.filter((row) => row.name.trim() && Number(row.price) > 0);
    if (!ready.length) return toast('Add at least one service or item with a price.', 'error');
    setBusy(true);
    try {
      for (const row of ready) {
        await api.post(`/stays/${stayId}/charge`, {
          kind: row.kind === 'item' ? 'other' : 'service',
          description: row.name.trim(),
          qty: 1,
          amount: Number(row.price),
        });
      }
      toast(`${ready.length} charge(s) added to the bill.`);
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Other service"
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            <Icon name="check" size={15} /> Save to bill
          </button>
        </>
      }
    >
      <h3 style={{ marginBottom: 10 }}>Quick services</h3>
      <div className="request-grid">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            className="request-tile"
            disabled={busy}
            onClick={() => addRow(service.kind === 'other' ? 'item' : 'service', service.name, service.price || 0)}
          >
            <Icon name={service.kind === 'other' ? 'box' : 'sparkles'} size={18} />
            <strong>{service.name}</strong>
            <span>{service.price ? money(service.price) : 'no charge'}</span>
          </button>
        ))}
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>Add to the bill</h3>
      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
        <button type="button" className="btn" onClick={() => addRow('service')}>
          <Icon name="plus" size={14} /> Add service
        </button>
        <button type="button" className="btn" onClick={() => addRow('item')}>
          <Icon name="plus" size={14} /> Add item
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing added yet" icon="plus" />
      ) : (
        <div className="stack">
          {rows.map((row) => (
            <div className="row" key={row.key} style={{ gap: 10 }}>
              <span className="pill gray" style={{ minWidth: 70, textAlign: 'center' }}>{row.kind === 'item' ? 'Item' : 'Service'}</span>
              <input
                style={{ flex: 1 }}
                value={row.name}
                placeholder={row.kind === 'item' ? 'e.g. Mineral water' : 'e.g. Laundry · 4 pieces'}
                onChange={(event) => setRow(row.key, { name: event.target.value })}
              />
              <input
                type="number"
                style={{ width: 110 }}
                value={row.price}
                placeholder="Price"
                onChange={(event) => setRow(row.key, { price: event.target.value })}
              />
              <button type="button" className="btn btn-sm btn-ghost" title="Cancel line" onClick={() => dropRow(row.key)}>
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          <div className="bill-total" style={{ borderRadius: 10 }}>
            <span>Total to add</span>
            <span>{money(rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0))}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ExtendModal({ folio, onClose, onDone }) {
  const { toast } = useApp();
  const [expected, setExpected] = useState(toLocalInput(folio?.expected_out_at));
  const [rate, setRate] = useState(String(folio?.rate || ''));

  return (
    <Modal
      title="Extend the stay"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await api.patch(`/stays/${folio.id}`, { expected_out_at: fromLocalInput(expected), rate: Number(rate) });
                toast('Stay updated — the bill will follow the new plan.');
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="check" size={15} /> Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Expected checkout" required>
          <input type="datetime-local" value={expected} onChange={(event) => setExpected(event.target.value)} />
        </Field>
        <Field label="Agreed rate" hint={folio?.billing_mode === 'nightly' ? 'Per night' : folio?.billing_mode === 'hourly' ? 'Per hour' : 'Per block'}>
          <input type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------- paid & release ------------------------------ */

export function CheckoutModal({ folio, totals, onClose, onDone }) {
  const { toast, loadRooms, loadStays } = useApp();
  const checkoutRef = useRef(''); // retry after a dropout must not release twice
  const [units, setUnits] = useState(folio?.live?.billedUnits || 1);
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState([{ amount: String(Math.max(0, totals?.balance || 0)), method: 'Cash' }]);
  const [release, setRelease] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState(null); // set when the server asks for a manager
  const [approvedBy, setApprovedBy] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [doneFolio, setDoneFolio] = useState(null); // checkout finished — show the receipt
  const now = useNow(1000);

  const currency = folio?.currency || 'ETB';
  const foreign = currency !== 'ETB' && Number(folio?.fx_rate) > 0;
  const rate = Number(folio?.fx_rate) || 1;
  // The guest agreed a currency at check-in: quote the bill in it.
  const guest = (value) => (foreign ? `${(Number(value) / rate).toFixed(2)} ${currency}` : money(value));
  // The room price as written at check-in — in the guest's own money.
  const pricePerUnit = Number(folio?.rate_foreign) || (foreign ? (Number(folio?.rate) || 0) / rate : Number(folio?.rate) || 0);

  if (doneFolio) {
    return (
      <ReceiptModal
        folio={doneFolio}
        room={{ number: doneFolio.room_number || folio?.room_number }}
        title="Receipt"
        onClose={onDone}
      />
    );
  }

  const charge = computeRoomCharge({ ...folio, units_override: units }, now);
  const otherCharges = (totals?.food || 0) + (totals?.service || 0) + (totals?.other || 0);
  const discountValue = Number(discount) || 0;
  const total = charge.amount + otherCharges - discountValue;
  const paid = (totals?.paid || 0) + payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const due = Math.round(total - paid);

  const submit = async ({ printAndGo = false } = {}) => {
    setBusy(true);
    if (!checkoutRef.current) checkoutRef.current = clientRef('checkout');
    try {
      const result = await api.post(`/stays/${folio.id}/checkout`, {
        unitsOverride: Number(units),
        discount: discountValue,
        approval_id: approvalId || undefined,
        releaseStatus: printAndGo ? 'available' : 'dirty',
        payments: payments
          .filter((payment) => Number(payment.amount) > 0)
          .map((payment) => (foreign && payment.in_guest
            ? {
              amount: Number(payment.amount) * rate,
              method: payment.method,
              currency,
              fxRate: rate,
              foreignAmount: Number(payment.amount),
            }
            : { amount: Number(payment.amount), method: payment.method })),
        release,
        client_ref: checkoutRef.current,
      });
      checkoutRef.current = '';
      toast(
        result.duplicate
          ? `Room ${result.room} was already released.`
          : printAndGo
            ? `Room ${result.room} is free again — green. Print the receipt; a copy goes to the admin.`
            : release
              ? `Room ${result.room} released. Housekeeping was told to turn it around.`
              : `Bill closed for Room ${result.room}. The room is still marked as occupied.`,
      );
      await loadRooms();
      await loadStays();
      if (result.folio) setDoneFolio(result.folio);
      else onDone?.();
    } catch (error) {
      if (error.status === 403 && error.payload?.needs_approval) {
        // The hotel's rule, enforced by the server: ask a manager to approve.
        setApproval({ message: error.message, limit: error.payload.limit });
      } else {
        toast(error.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Check out · Room ${folio?.room_number}`}
      subtitle={`${folio?.guest?.full_name} · checked in ${dateTimeOf(folio?.check_in_at)}`}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => submit({ printAndGo: false })} disabled={busy}>
            <Icon name="check" size={15} /> Close bill · {foreign ? guest(total) : money(total)}
          </button>
          <button className="btn btn-primary" onClick={() => submit({ printAndGo: true })} disabled={busy}>
            <Icon name="print" size={15} /> Print &amp; check out
          </button>
        </>
      }
    >
      <div className="grid grid-2" style={{ gap: 18 }}>
        <div>
          <h3 style={{ marginBottom: 10 }}>Room charge</h3>
          <div className="card card-pad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Time in the room</span>
              <strong>{formatElapsed(charge.elapsedMs)}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="small">
                {BILLING_MODES[charge.mode].label} counted
                <div className="tiny muted">Started {charge.units} · you can correct it below</div>
              </span>
              <div className="qty">
                <button onClick={() => setUnits(Math.max(1, Number(units) - 1))}>−</button>
                <span>{units}</span>
                <button onClick={() => setUnits(Number(units) + 1)}>+</button>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
              <span className="small">Price per {charge.unitLabel}</span>
              <strong>{foreign ? `${pricePerUnit.toFixed(2)} ${currency}` : money(folio?.rate)}</strong>
            </div>
            <div className="bill-total" style={{ marginTop: 12, borderRadius: 10 }}>
              <span>Room total</span>
              <span>{guest(charge.amount)}</span>
            </div>
          </div>

          <h3 style={{ margin: '18px 0 10px' }}>Discount</h3>
          <div className="form-grid">
            <Field
              label="Discount / waiver (birr)"
              hint={approvalId
                ? `Approved by ${approvedBy}.`
                : `Above ${money(approval?.limit?.amount ?? 0)} a manager has to approve it.`}
            >
              <input type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" />
            </Field>
          </div>
          {approvalId ? (
            <div className="banner info" style={{ marginTop: 10 }}>
              <Icon name="shield" size={14} /> <span>Approved by <strong>{approvedBy}</strong> — good for this checkout only.</span>
            </div>
          ) : null}
          {approval ? (
            <div className="card card-pad" style={{ marginTop: 10, borderColor: '#e6cfa8', background: '#fffaf1' }}>
              <strong className="small">{approval.message}</strong>
              <p className="tiny muted" style={{ marginTop: 6 }}>
                The manager types their own PIN — the discount cannot be taken without it.
              </p>
              <ApprovalBox
                kind="discount"
                amount={discountValue}
                onApproved={(result) => {
                  setApprovalId(result.approvalId);
                  setApprovedBy(result.approvedBy);
                  setApproval(null);
                  toast(`Approved by ${result.approvedBy}. Press confirm again.`);
                }}
              />
            </div>
          ) : null}
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Bill</h3>
          <div className="bill">
            <div className="bill-line">
              <div className="desc">Room · {units} × {foreign ? `${pricePerUnit.toFixed(2)} ${currency}` : money(folio?.rate)}</div>
              <strong>{guest(charge.amount)}</strong>
            </div>
            <div className="bill-line">
              <div className="desc">Food, drinks &amp; services</div>
              <strong>{money(otherCharges)}</strong>
            </div>
            {discountValue ? (
              <div className="bill-line neg">
                <div className="desc">Discount</div>
                <strong>−{money(discountValue)}</strong>
              </div>
            ) : null}
            <div className="bill-line">
              <div className="desc">Already paid (deposits)</div>
              <strong>−{money(totals?.paid)}</strong>
            </div>
            <div className="bill-total due">
              <span>To collect now</span>
              <span>
                {money(Math.max(0, due))}
                {foreign ? <div className="tiny" style={{ opacity: .85 }}>{guest(Math.max(0, due))}</div> : null}
              </span>
            </div>
          </div>

          {foreign ? (
            <div className="banner info" style={{ marginTop: 12 }}>
              <Icon name="exchange" size={14} />
              <span><strong>{currency}</strong> @ {rate}</span>
            </div>
          ) : null}

          <h3 style={{ margin: '18px 0 10px' }}>Payment</h3>
          {payments.map((payment, index) => (
            <div className="row" key={index} style={{ marginBottom: 8 }}>
              <input
                type="number"
                value={payment.amount}
                onChange={(event) => setPayments(payments.map((row, i) => (i === index ? { ...row, amount: event.target.value } : row)))}
                style={{ flex: 1, border: '1px solid var(--line-dark)', borderRadius: 10, padding: '9px 11px' }}
              />
              {foreign ? (
                <label className="row" style={{ gap: 6, cursor: 'pointer' }} title={`Amount is in ${currency}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(payment.in_guest)}
                    onChange={(event) => setPayments(payments.map((row, i) => (i === index ? { ...row, in_guest: event.target.checked } : row)))}
                  />
                  <span className="small">{currency}</span>
                </label>
              ) : null}
              <select
                value={payment.method}
                onChange={(event) => setPayments(payments.map((row, i) => (i === index ? { ...row, method: event.target.value } : row)))}
                style={{ border: '1px solid var(--line-dark)', borderRadius: 10, padding: '9px 11px' }}
              >
                {['Cash', 'Card', 'Mobile payment', 'Bank transfer', 'Corporate account'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              {payments.length > 1 ? (
                <button className="btn btn-sm" onClick={() => setPayments(payments.filter((_, i) => i !== index))}>
                  <Icon name="trash" size={13} />
                </button>
              ) : null}
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => setPayments([...payments, { amount: '', method: 'Card' }])}>
            <Icon name="plus" size={13} /> Split payment
          </button>

          <label className="row" style={{ marginTop: 16, gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={release} onChange={(event) => setRelease(event.target.checked)} style={{ width: 18, height: 18 }} />
            <span className="small">
              Release the room now
            </span>
          </label>

          {due > 0 ? (
            <div className="banner warn" style={{ marginTop: 14 }}>
              <Icon name="alert" size={15} />
              <span>{money(due)} will stay on the guest account as unpaid.</span>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------- guests who filled the form from the QR ------------------ */

function PendingRegistrations({ requests, rooms, onDone }) {
  const { toast, loadRequests } = useApp();
  const [busyId, setBusyId] = useState(null);

  const decide = async (request, decision) => {
    setBusyId(request.id);
    try {
      if (decision === 'approve') {
        await api.post(`/checkin-requests/${request.id}/approve`, {});
        toast(`${request.payload.full_name} is checked in — the room is occupied and the bill started.`);
      } else {
        await api.post(`/checkin-requests/${request.id}/reject`, { reason: 'Declined at the desk' });
        toast('Request declined.', 'warn');
      }
      await Promise.all([loadRequests(), onDone?.()]);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: 'var(--amber, #e0a80d)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="eyebrow">Waiting for the desk</div>
          <strong>{requests.length} guest{requests.length > 1 ? 's' : ''} filled the form by phone</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Check the name and phone against the ID, then approve — that checks the guest in and starts the bill.
          </div>
        </div>
        <Pill status="new">New</Pill>
      </div>
      {requests.map((request) => {
        const room = rooms.find((item) => item.id === request.room_id);
        const rows = Object.entries(request.payload || {}).filter(([key]) => !['room_id', 'stay_id'].includes(key));
        return (
          <div key={request.id} className="card" style={{ padding: 12, marginBottom: 8, background: '#f8fbfa' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>Room {room?.number || request.room_id}</strong> · {request.payload.full_name}
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(request.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="row">
                <button className="btn btn-primary btn-sm" disabled={busyId === request.id} onClick={() => decide(request, 'approve')}>
                  <Icon name="check" size={13} /> Check in
                </button>
                <button className="btn btn-sm" disabled={busyId === request.id} onClick={() => decide(request, 'reject')}>
                  <Icon name="x" size={13} /> Decline
                </button>
              </div>
            </div>
            <div className="kv" style={{ marginTop: 8 }}>
              {rows.map(([key, value]) => (
                <div key={key}>
                  <div className="k">{key.replace(/_/g, ' ')}</div>
                  <div className="v">{String(value || '—')}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------- rooms waiting for housekeeping --------------------- */

function CleaningQueue({ rooms, onDone }) {
  const { toast } = useApp();
  const [busyId, setBusyId] = useState(null);

  const clean = async (room, inspected = false) => {
    setBusyId(room.id);
    try {
      await api.post(`/rooms/${room.id}/cleaned`, { inspected });
      toast(
        inspected
          ? `Room ${room.number} inspected — back on sale.`
          : `Room ${room.number} is clean — green again.`,
      );
      await onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remind = async (room) => {
    try {
      await api.post(`/rooms/${room.id}/nudge-cleaning`, {});
      toast(`Housekeeping rung again for Room ${room.number}.`, 'info');
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <div className="card clean-queue" style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="eyebrow">Housekeeping</div>
          <strong>{rooms.length} room{rooms.length > 1 ? 's' : ''} waiting to be cleaned</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Tell the housekeeper the room number, then tap <strong>Cleaned</strong> here when she is done — the room goes green again.
          </div>
        </div>
        <Pill status="pending">Needs cleaning</Pill>
      </div>
      <div className="clean-row">
        {rooms.map((room) => (
          <div key={room.id} className={`clean-card ${room.status === 'cleaning' ? 'working' : ''}`}>
            <div className="clean-num">{room.number}</div>
            <div className="clean-state">{room.status === 'cleaning' ? 'Being cleaned' : 'Needs cleaning'}</div>
            <div className="clean-actions">
              <button className="btn btn-sm btn-primary" disabled={busyId === room.id} onClick={() => clean(room)}>
                <Icon name="check" size={13} /> Cleaned
              </button>
              {room.status === 'dirty' ? (
                <button className="btn btn-sm" onClick={() => remind(room)} title="Ring the housekeeping board again">
                  <Icon name="bell" size={13} /> Tell
                </button>
              ) : null}
              <button className="btn btn-sm btn-ghost" disabled={busyId === room.id} onClick={() => clean(room, true)}>
                <Icon name="shield" size={13} /> Inspected
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * A manager's PIN, typed by the manager, for a discount or a void.
 * The server issues a one-shot approval; it cannot be reused.
 */
export function ApprovalBox({ kind, amount, detail, onApproved }) {
  const { toast } = useApp();
  const [username, setUsername] = useState('manager');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
      <Field label="Manager username">
        <input value={username} onChange={(event) => setUsername(event.target.value)} />
      </Field>
      <Field label="Manager PIN">
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="••••"
          onKeyDown={async (event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </Field>
      <button
        className="btn btn-primary"
        disabled={busy || !pin}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await api.post('/approvals', { kind, amount, detail, managerUsername: username, managerPin: pin });
            setPin('');
            onApproved?.(result);
          } catch (error) {
            toast(error.message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="shield" size={14} /> Approve
      </button>
    </div>
  );
}

/** The guest's identity document: photograph it, look at it, or clear it. */
export function IdDocumentCard({ guest, onUploaded }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const file = useRef(null);

  const upload = async (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(chosen);
      const result = await api.post(`/guests/${guest.id}/document`, { data_url: dataUrl });
      toast('Identity document saved on the guest file.');
      onUploaded?.(result.url);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  const copy = guest.id_document_url ? mediaUrl(guest.id_document_url) : null;

  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3><Icon name="id-card" size={15} /> Identity document</h3>
          <p className="tiny muted" style={{ marginTop: 6 }}>
            {copy
              ? `Kept on the guest file, photographed ${relative(guest.id_document_at)} by ${guest.id_document_by || 'the desk'}.`
              : 'Photograph the passport or ID at check-in — the police register asks for it.'}
          </p>
        </div>
        <div className="row">
          {copy ? (
            <>
              <button className="btn btn-sm" onClick={() => setOpen(true)}><Icon name="eye" size={13} /> Look</button>
              <a className="btn btn-sm" href={copy} download><Icon name="download" size={13} /> Save</a>
            </>
          ) : null}
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => file.current?.click()}>
            <Icon name="camera" size={13} /> {busy ? 'Saving…' : copy ? 'Replace' : 'Photograph'}
          </button>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
        </div>
      </div>
      {open && copy ? (
        <Modal title={`${guest.full_name} · identity document`} onClose={() => setOpen(false)} footer={<button className="btn" onClick={() => setOpen(false)}>Close</button>}>
          <img src={copy} alt="Identity document" style={{ width: '100%', borderRadius: 12 }} />
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Opening the document is written to the audit log. Scans older than the hotel's retention rule are deleted automatically.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
