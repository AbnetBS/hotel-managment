import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useNow, useTopic } from '../lib/store.jsx';
import { computeRoomCharge, BILLING_MODES } from '../../../shared/billing.js';
import { money, formatElapsed, formatCountdown, initials, dateTimeOf, toLocalInput, fromLocalInput } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';
import { Modal, Drawer, Field, Pill, Empty, Stat } from '../lib/ui.jsx';
import { NewOrderModal } from '../components/OrderPieces.jsx';

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
          <p className="page-desc">
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>Green</span> is free — tap it to show the room to a guest.{' '}
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>Red</span> is occupied — the bill counts by itself.{' '}
            <span style={{ color: 'var(--purple)', fontWeight: 700 }}>Purple</span> needs cleaning — housekeeping has been told.{' '}
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>Blue</span> is being cleaned.
          </p>
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

/* ------------------------------- the room -------------------------------- */

function RoomDrawer({ room: roomSummary, onClose, onCheckIn, onNewOrder }) {
  const { toast, requests, loadRooms, loadRequests, settings, user } = useApp();
  const [detail, setDetail] = useState(null);
  const [photo, setPhoto] = useState(0);
  const [modal, setModal] = useState(null); // 'payment' | 'charge' | 'checkout' | 'extend'
  const now = useNow(1000);

  const room = detail?.room || roomSummary;
  const folio = detail?.folio || null;
  const stay = room.stay;
  const live = stay ? computeRoomCharge(folio || stay, now) : null;
  const totals = folio?.totals || room.totals;
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
              <div className="big">{money(totals?.room)}</div>
              <div className="tiny" style={{ color: '#93b6ae', marginTop: 6 }}>
                {live.billedUnits} {live.billedUnits === 1 ? live.unitLabel : live.unitLabelPlural} on the clock
              </div>
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={onNewOrder}>
              <Icon name="utensils" size={14} /> Add order
            </button>
            <button className="btn" onClick={() => setModal('payment')}>
              <Icon name="banknote" size={14} /> Take payment
            </button>
            <button className="btn" onClick={() => setModal('charge')}>
              <Icon name="plus" size={14} /> Add service charge
            </button>
            <button className="btn" onClick={() => setModal('extend')}>
              <Icon name="calendar" size={14} /> Extend stay
            </button>
            <button className="btn btn-dark" onClick={() => setModal('checkout')}>
              <Icon name="log-out" size={14} /> Paid &amp; release room
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
                  <div className="sub">Everything the guest ordered, with its exact stage</div>
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
          <div className="banner good">
            <Icon name="check-circle" size={16} />
            <span>
              <strong>Room {room.number} is free and ready.</strong> Show the guest the photos and price above, then check them in — the room
              turns red and the {BILLING_MODES[room.billing_mode]?.label.toLowerCase() || 'nightly'} counter starts.
            </span>
          </div>
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
            <div className="sub">Only a paid &amp; released room can be cleared for the next guest.</div>
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
              <Icon name="sparkles" size={15} /> Cleaned · ንጹህ ሆነ
            </button>
          ) : null}
          {stay ? <div className="tiny muted" style={{ marginTop: 10 }}>Release the room first — “Paid &amp; release room” — before clearing it.</div> : null}
        </div>
      </div>

      {modal === 'payment' ? <PaymentModal stayId={folio.id} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); loadRooms(); }} /> : null}
      {modal === 'charge' ? <ChargeModal stayId={folio.id} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); loadRooms(); }} /> : null}
      {modal === 'extend' ? <ExtendModal folio={folio} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} /> : null}
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
    { key: 'room', label: 'Room', am: 'ክፍል', items: of(['room']) },
    { key: 'food', label: 'Food & drinks', am: 'ምግብ እና መጠጥ', items: of(['food']) },
    { key: 'service', label: 'Hotel services', am: 'አገልግሎቶች', items: of(['service', 'other']) },
    { key: 'discount', label: 'Discounts', am: 'ቅናሽ', items: of(['discount']) },
    { key: 'payment', label: 'Payments received', am: 'የተከፈለ', items: of(['payment']) },
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
            <span>{group.label} <em>{group.am}</em></span>
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
    setRate(String(price || ''));
    setUnits(mode === 'nightly' ? 1 : mode === 'dayuse' ? (type.dayuse_hours || 3) : 1);
  }, [mode, room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) return null;
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const estimated = (Number(rate) || 0) * Math.max(1, Number(units) || 1);

  const submit = async () => {
    const missing = fields.filter((field) => field.required && !String(values[field.key] || '').trim());
    if (missing.length) return toast(`Please fill in: ${missing.map((field) => field.label).join(', ')}`, 'error');
    setBusy(true);
    try {
      const expected = new Date(Date.now() + (mode === 'nightly' ? 1 : mode === 'dayuse' ? (room.type?.dayuse_hours || 3) : 1) * 3600 * 1000 * Math.max(1, Number(units) || 1));
      const result = await api.post(`/rooms/${room.id}/checkin`, {
        guest: values,
        billing_mode: mode,
        rate: Number(rate) || undefined,
        deposit: Number(deposit) || 0,
        method,
        adults: Number(values.adults) || 1,
        expected_out_at: expected.toISOString(),
        note,
      });
      toast(`${values.full_name} is checked in to Room ${room.number}. The room is now red and the bill is running.`);
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
      <div className="banner info" style={{ marginBottom: 16 }}>
        <Icon name="clipboard" size={15} />
        <span>
          These are the questions your hotel asks every guest — the admin decides which ones appear, in <strong>Guest form</strong>.
        </span>
      </div>

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
        <Field label={mode === 'nightly' ? 'Rate per night' : mode === 'hourly' ? 'Rate per hour' : 'Rate per day-use block'}>
          <input type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
        </Field>
        <Field label={mode === 'nightly' ? 'Nights planned' : mode === 'hourly' ? 'Hours planned' : 'Day-use blocks'}>
          <input type="number" min="1" value={units} onChange={(event) => setUnits(event.target.value)} />
        </Field>
        <Field label="Deposit taken now" hint={`Planned room cost ≈ ${money(estimated)}`}>
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
    </Modal>
  );
}

/* ------------------------------- payments -------------------------------- */

export function PaymentModal({ stayId, onClose, onDone }) {
  const { toast } = useApp();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/stays/${stayId}/payment`, { amount: Number(amount), method, reference });
      toast(`${money(Number(amount))} received (${method}).`);
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
      subtitle="The amount is taken off the guest bill straight away."
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
      <div className="form-grid">
        <Field label="Amount received" required>
          <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" autoFocus />
        </Field>
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
  const [kind, setKind] = useState('service');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  return (
    <Modal
      title="Add a charge to the bill"
      subtitle="Laundry, minibar, airport transfer, conference room — anything outside the menu."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!description || !Number(amount)}
            onClick={async () => {
              try {
                await api.post(`/stays/${stayId}/charge`, { kind, description, amount: Number(amount) });
                toast(`${money(Number(amount))} added to the bill.`);
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="plus" size={15} /> Add to bill
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Type">
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="service">Service</option>
            <option value="other">Other</option>
            <option value="food">Food &amp; drinks</option>
          </select>
        </Field>
        <Field label="Amount" required>
          <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Description" required full>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Laundry · 4 pieces" />
        </Field>
      </div>
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
      subtitle="Change the planned checkout time or agree a new rate."
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
  const [units, setUnits] = useState(folio?.live?.billedUnits || 1);
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState([{ amount: String(Math.max(0, totals?.balance || 0)), method: 'Cash' }]);
  const [release, setRelease] = useState(true);
  const [busy, setBusy] = useState(false);
  const now = useNow(1000);

  const charge = computeRoomCharge({ ...folio, units_override: units }, now);
  const otherCharges = (totals?.food || 0) + (totals?.service || 0) + (totals?.other || 0);
  const discountValue = Number(discount) || 0;
  const total = charge.amount + otherCharges - discountValue;
  const paid = (totals?.paid || 0) + payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const due = Math.round(total - paid);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post(`/stays/${folio.id}/checkout`, {
        unitsOverride: Number(units),
        discount: discountValue,
        payments: payments.filter((payment) => Number(payment.amount) > 0),
        release,
      });
      toast(
        release
          ? `Room ${result.room} released. Housekeeping was told to turn it around.`
          : `Bill closed for Room ${result.room}. The room is still marked as occupied.`,
      );
      await loadRooms();
      await loadStays();
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Paid & release · Room ${folio?.room_number}`}
      subtitle={`${folio?.guest?.full_name} · checked in ${dateTimeOf(folio?.check_in_at)}`}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-dark" onClick={submit} disabled={busy}>
            <Icon name="check" size={15} /> Confirm · {money(total)} bill
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
              <span className="small">Rate per {charge.unitLabel}</span>
              <strong>{money(folio?.rate)}</strong>
            </div>
            <div className="bill-total" style={{ marginTop: 12, borderRadius: 10 }}>
              <span>Room total</span>
              <span>{money(charge.amount)}</span>
            </div>
          </div>

          <h3 style={{ margin: '18px 0 10px' }}>Discount</h3>
          <div className="form-grid">
            <Field label="Discount / waiver" hint="Owner approvals, long stay, complaint…">
              <input type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Bill</h3>
          <div className="bill">
            <div className="bill-line">
              <div className="desc">Room · {units} × {money(folio?.rate)}</div>
              <strong>{money(charge.amount)}</strong>
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
              <span>{money(Math.max(0, due))}</span>
            </div>
          </div>

          <h3 style={{ margin: '18px 0 10px' }}>Payment</h3>
          {payments.map((payment, index) => (
            <div className="row" key={index} style={{ marginBottom: 8 }}>
              <input
                type="number"
                value={payment.amount}
                onChange={(event) => setPayments(payments.map((row, i) => (i === index ? { ...row, amount: event.target.value } : row)))}
                style={{ flex: 1, border: '1px solid var(--line-dark)', borderRadius: 10, padding: '9px 11px' }}
              />
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
              <span className="tiny muted" style={{ display: 'block' }}>Marks it “needs cleaning” and sends housekeeping a turnover task.</span>
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
        <Pill status="new">ደረሰኝ · new</Pill>
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
          <div className="eyebrow">Housekeeping · ጽዳት</div>
          <strong>{rooms.length} room{rooms.length > 1 ? 's' : ''} waiting to be cleaned</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Tell the housekeeper the room number, then tap <strong>Cleaned</strong> here when she is done — the room goes green again.
          </div>
        </div>
        <Pill status="pending">ማጽዳት ይፈልጋል</Pill>
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
