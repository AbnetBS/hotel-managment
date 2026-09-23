import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useNow } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money, formatElapsed, dateOf, dateTimeOf, nightsBetween } from '../lib/format.js';
import { Stat, Empty, Card, Modal, Field, Pill, Drawer } from '../lib/ui.jsx';
import { CheckoutModal, PaymentModal, IdDocumentCard } from './Rooms.jsx';
import { computeRoomCharge } from '../../../shared/billing.js';

/** What the desk can do with a booking, exactly as a real hotel works it. */
const BOOKING_STEPS = {
  inquiry: [{ status: 'tentative', label: 'Hold' }, { status: 'confirmed', label: 'Confirm', primary: true }],
  tentative: [{ status: 'confirmed', label: 'Confirm', primary: true }, { status: 'cancelled', label: 'Cancel' }],
  confirmed: [
    { status: 'checked-in', label: 'Guest arrived', primary: true },
    { status: 'no-show', label: 'No-show' },
    { status: 'cancelled', label: 'Cancel', ask: 'Why is this booking being cancelled?' },
  ],
  'checked-in': [{ status: 'checked-out', label: 'Checked out' }],
  cancelled: [],
  'no-show': [],
  'checked-out': [],
};

export default function Front({ mode }) {
  if (mode === 'reservations') return <Reservations />;
  return <Stays mode={mode} />;
}

/* ------------------------------ reservations ----------------------------- */

function Reservations() {
  const { rooms, roomTypes, toast, loadReservations, reservations, loadRooms } = useApp();
  const [showNew, setShowNew] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Coming up</div>
          <h1>Reservations</h1>
          <p className="page-desc">
            Keep the diary here so the room board tells the truth: reserved rooms show amber and cannot be sold twice.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={15} /> New reservation
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Confirmed" value={reservations.filter((item) => item.status === 'confirmed').length} icon="calendar" />
        <Stat
          label="Expected today"
          value={reservations.filter((item) => item.arrival?.slice(0, 10) === new Date().toISOString().slice(0, 10) && ['confirmed', 'tentative'].includes(item.status)).length}
          icon="user-plus"
          foot="Arrivals still to come"
        />
        <Stat label="Waiting for confirmation" value={reservations.filter((item) => item.status === 'pending').length} icon="clock" alert={reservations.some((item) => item.status === 'pending')} />
        <Stat
          label="Deposits held"
          value={money(reservations.reduce((sum, item) => sum + (item.deposit || 0), 0))}
          icon="banknote"
        />
      </div>

      <Card title="Booking diary" subtitle="Soonest arrival first" noBody>
        {reservations.length === 0 ? (
          <Empty title="No reservations yet" hint="Add the first booking and it will show here." icon="calendar" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Dates</th>
                <th>Nights</th>
                <th>Rate</th>
                <th>Source</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reservations.map((resa) => (
                <tr key={resa.id}>
                  <td>
                    <strong>{resa.guest_name}</strong>
                    <div className="tiny muted">{resa.phone || '—'} · {resa.code}</div>
                  </td>
                  <td>{resa.room_number === '—' ? <span className="muted">{resa.room_type}</span> : <strong>Room {resa.room_number}</strong>}</td>
                  <td className="small">{dateOf(resa.arrival)} → {dateOf(resa.departure)}</td>
                  <td>{resa.nights}</td>
                  <td>{money(resa.rate)}</td>
                  <td className="small muted">{resa.source}</td>
                  <td><Pill status={resa.status}>{resa.status}</Pill></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      {(BOOKING_STEPS[resa.status] || []).map((step) => (
                        <button
                          key={step.status}
                          className={`btn btn-sm ${step.primary ? 'btn-primary' : ''}`}
                          onClick={async () => {
                            try {
                              await api.post(`/reservations/${resa.id}/status`, { status: step.status, reason: step.ask ? window.prompt(step.ask) || undefined : undefined });
                              toast(`${resa.guest_name}: ${step.status}.`, step.status === 'cancelled' || step.status === 'no-show' ? 'info' : 'success');
                              loadReservations();
                              loadRooms?.();
                            } catch (error) {
                              toast(error.message, 'error');
                            }
                          }}
                        >
                          {step.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showNew ? (
        <NewReservationModal
          rooms={rooms}
          roomTypes={roomTypes}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            loadReservations();
          }}
        />
      ) : null}
    </>
  );
}

function NewReservationModal({ rooms, roomTypes, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({
    guest_name: '',
    phone: '',
    room_id: '',
    room_type_id: roomTypes[0]?.id || '',
    arrival: new Date().toISOString().slice(0, 10),
    departure: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    rate: roomTypes[0]?.nightly_rate || '',
    source: 'Phone',
    deposit: '',
    note: '',
  });
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const nights = nightsBetween(form.arrival, form.departure);

  return (
    <Modal
      title="New reservation"
      subtitle="Hold the room in the diary before the guest arrives."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.guest_name}
            onClick={async () => {
              try {
                const result = await api.post('/reservations', { ...form, rate: Number(form.rate), deposit: Number(form.deposit) || 0 });
                toast(`Booking ${result.code} created for ${nights} night(s).`);
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="calendar" size={15} /> Save booking
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Guest name" required>
          <input value={form.guest_name} onChange={(event) => set('guest_name')(event.target.value)} autoFocus />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(event) => set('phone')(event.target.value)} placeholder="+251…" />
        </Field>
        <Field label="Room (if known)">
          <select value={form.room_id} onChange={(event) => set('room_id')(event.target.value)}>
            <option value="">Assign later</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>Room {room.number} · {room.type?.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Room type">
          <select value={form.room_type_id} onChange={(event) => set('room_type_id')(event.target.value)}>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Arrival" required>
          <input type="date" value={form.arrival} onChange={(event) => set('arrival')(event.target.value)} />
        </Field>
        <Field label="Departure" required hint={`${nights} night(s)`}>
          <input type="date" value={form.departure} onChange={(event) => set('departure')(event.target.value)} />
        </Field>
        <Field label="Agreed rate / night">
          <input type="number" value={form.rate} onChange={(event) => set('rate')(event.target.value)} />
        </Field>
        <Field label="Deposit taken">
          <input type="number" value={form.deposit} onChange={(event) => set('deposit')(event.target.value)} placeholder="0" />
        </Field>
        <Field label="How did they book?">
          <select value={form.source} onChange={(event) => set('source')(event.target.value)}>
            {['Phone', 'Walk-in', 'Email', 'Corporate', 'Agent'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <input value={form.note} onChange={(event) => set('note')(event.target.value)} placeholder="Airport pickup, late arrival…" />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------- stays --------------------------------- */

function Stays({ mode }) {
  const { stays, rooms, toast, loadStays, loadRooms, user } = useApp();
  const [openId, setOpenId] = useState(null);
  const [paymentFor, setPaymentFor] = useState(null);
  const [checkoutFor, setCheckoutFor] = useState(null);
  const now = useNow(1000);

  const enriched = stays.map((stay) => {
    const room = rooms.find((item) => item.id === stay.room_id);
    const live = computeRoomCharge(stay, now);
    return { ...stay, room_number: room?.number || stay.room_number, room_type_name: room?.type?.name, live, balance: stay.totals.balance };
  });

  const outstanding = enriched.reduce((sum, stay) => sum + Math.max(0, stay.balance), 0);

  const refresh = async () => {
    await loadStays();
    await loadRooms();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">In house right now</div>
          <h1>{mode === 'folios' ? 'Guest bills' : 'In-house guests'}</h1>
          <p className="page-desc">
            {mode === 'folios'
              ? 'Every open bill with the live room charge, food and drinks, deposits and the balance still to collect.'
              : 'Who is in which room, since when, and how much they owe. Open a guest to see and settle the whole bill.'}
          </p>
        </div>
        <button className="btn" onClick={refresh}>
          <Icon name="rotate-ccw" size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Guests in house" value={enriched.length} icon="users" foot={`${rooms.filter((room) => room.status === 'occupied').length} rooms occupied`} />
        <Stat label="Open bills" value={money(enriched.reduce((sum, stay) => sum + stay.totals.total, 0))} icon="receipt" foot="Live, including the running room charge" />
        <Stat label="Still to collect" value={money(outstanding)} icon="banknote" alert={outstanding > 0} foot="Deposits already taken off" />
      </div>

      <Card title={mode === 'folios' ? 'Open bills' : 'Active stays'} subtitle="Ordered by check-in" noBody>
        {enriched.length === 0 ? (
          <Empty title="Nobody is checked in" hint="Check a guest in from the room board and their bill appears here." icon="users" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Stay</th>
                <th>Room charge</th>
                <th>Food &amp; services</th>
                <th>Paid</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enriched.map((stay) => (
                <tr key={stay.id}>
                  <td>
                    <strong>{stay.guest?.full_name}</strong>
                    <div className="tiny muted">{stay.guest?.phone} · {stay.guest?.nationality || ''}</div>
                  </td>
                  <td><strong>Room {stay.room_number}</strong><div className="tiny muted">{stay.room_type_name}</div></td>
                  <td className="small">
                    {dateOf(stay.check_in_at)} · {formatElapsed(stay.live.elapsedMs)}
                    <div className="tiny muted">planned out {dateOf(stay.expected_out_at)}</div>
                  </td>
                  <td>{money(stay.totals.room)}</td>
                  <td>{money(stay.totals.food + stay.totals.service + stay.totals.other)}</td>
                  <td className="small">{money(stay.totals.paid)}</td>
                  <td><strong>{money(stay.balance)}</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => setOpenId(stay.id)}>Open</button>
                      <button className="btn btn-sm btn-soft" onClick={() => setPaymentFor(stay)}>Payment</button>
                      <button className="btn btn-sm btn-dark" onClick={() => setCheckoutFor(stay)}>Paid &amp; release</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {openId ? <FolioDrawer stayId={openId} onClose={() => setOpenId(null)} onChanged={refresh} /> : null}
      {paymentFor ? (
        <PaymentModal
          stayId={paymentFor.id}
          currency={paymentFor.currency}
          fxRate={paymentFor.fx_rate}
          balance={paymentFor.totals?.balance}
          onClose={() => setPaymentFor(null)}
          onDone={() => {
            setPaymentFor(null);
            refresh();
          }}
        />
      ) : null}
      {checkoutFor ? (
        <CheckoutModal
          folio={checkoutFor}
          totals={checkoutFor.totals}
          onClose={() => setCheckoutFor(null)}
          onDone={() => {
            setCheckoutFor(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

function FolioDrawer({ stayId, onClose, onChanged }) {
  const { toast } = useApp();
  const [data, setData] = useState(null);

  const load = async () => setData(await api.get(`/stays/${stayId}`));

  useEffect(() => {
    load();
  }, [stayId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const { stay, orders } = data;

  return (
    <Drawer
      wide
      onClose={onClose}
      title={`${stay.guest?.full_name} · Room ${stay.room_number}`}
      subtitle={`${stay.code} · ${stay.billing_mode} @ ${money(stay.rate)} · checked in ${dateTimeOf(stay.check_in_at)}`}
    >
      {stay.currency && stay.currency !== 'ETB' && stay.fx_rate ? (
        <div className="banner info" style={{ marginBottom: 12 }}>
          <Icon name="exchange" size={15} />
          <span>
            Billed in <strong>{stay.currency}</strong> at {stay.fx_rate} birr (frozen at check-in) ·
            total ≈ {(stay.totals.total / stay.fx_rate).toFixed(2)} {stay.currency} ·
            balance ≈ {(stay.totals.balance / stay.fx_rate).toFixed(2)} {stay.currency}
          </span>
        </div>
      ) : null}

      <div className="bill">
        <div className="bill-line" style={{ background: '#f8fbfa' }}>
          <div className="desc"><strong>Bill summary</strong></div>
          <strong>{money(stay.totals.total)}</strong>
        </div>
        {stay.items.map((item) => (
          <div className={`bill-line ${item.amount < 0 ? 'neg' : ''}`} key={item.id}>
            <div className="desc">
              {item.description}
              <small>{dateTimeOf(item.created_at)}{item.method ? ` · ${item.method}` : ''}</small>
            </div>
            <strong>{money(item.amount)}</strong>
          </div>
        ))}
        {stay.items.length === 0 ? (
          <div className="bill-line">
            <div className="desc">Room charge is counting live</div>
            <strong>{money(stay.totals.room)}</strong>
          </div>
        ) : null}
        <div className="bill-total due">
          <span>Balance to collect</span>
          <span>{money(stay.totals.balance)}</span>
        </div>
      </div>

      {orders.length ? (
        <Card title="Orders" subtitle="Attached to this room" noBody>
          {orders.map((order) => (
            <div className="bill-line" key={order.id}>
              <div className="desc">
                #{order.code} · {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                <small>{order.statusLabel} · {order.charged ? 'on the bill' : 'not charged yet'}</small>
              </div>
              <strong>{money(order.total)}</strong>
            </div>
          ))}
        </Card>
      ) : null}

      {stay.voidItems?.length ? (
        <Card title="Voided charges" subtitle="Kept for the audit trail" noBody>
          {stay.voidItems.map((item) => (
            <div className="bill-line" key={item.id}>
              <div className="desc muted">{item.description}</div>
              <strong className="muted">{money(item.amount)}</strong>
            </div>
          ))}
        </Card>
      ) : null}

      {stay.status === 'active' ? (
        <>
          <PostServiceCard stayId={stay.id} onPosted={async () => { await load(); await onChanged?.(); }} />
          <IdDocumentCard guest={stay.guest} onUploaded={load} />
        </>
      ) : null}

      <div className="row">
        <button
          className="btn"
          onClick={async () => {
            await load();
            await onChanged?.();
            toast('Bill refreshed.');
          }}
        >
          <Icon name="rotate-ccw" size={14} /> Refresh
        </button>
        <button className="btn btn-danger" onClick={onClose}>Close</button>
      </div>
    </Drawer>
  );
}


/**
 * Post a hotel service to this guest's bill in one tap — laundry, a taxi, the
 * minibar. The list is the hotel's own, so the desk never retypes a price.
 */
function PostServiceCard({ stayId, onPosted }) {
  const { toast } = useApp();
  const [services, setServices] = useState([]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.get('/services').then((data) => setServices(data.services || [])).catch(() => setServices([]));
  }, []);

  if (!services.length) return null;

  return (
    <Card title="Post a service to this room" subtitle="Charged to the bill straight away">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="small muted">Quantity</span>
        <div className="qty">
          <button onClick={() => setQty(Math.max(1, Number(qty) - 1))}>−</button>
          <span>{qty}</span>
          <button onClick={() => setQty(Number(qty) + 1)}>+</button>
        </div>
      </div>
      <div className="chips">
        {services.map((service) => (
          <button
            key={service.id}
            className="chip"
            disabled={busy === service.id}
            onClick={async () => {
              setBusy(service.id);
              try {
                const result = await api.post(`/stays/${stayId}/service`, { serviceId: service.id, qty: Number(qty) || 1 });
                toast(`${service.name} added — ${money(result.etb)} on the bill.`);
                onPosted?.();
              } catch (error) {
                toast(error.message, 'error');
              } finally {
                setBusy('');
              }
            }}
          >
            <Icon name="plus" size={11} /> {service.name}{service.price ? ` · ${money(service.price)}` : ''}
          </button>
        ))}
      </div>
    </Card>
  );
}
