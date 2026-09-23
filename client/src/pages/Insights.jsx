import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useNow, useTopic } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money, formatElapsed, dateOf, dateTimeOf, dayLong, relative } from '../lib/format.js';
import { Stat, Card, Empty, Bars, Pill, Seg, Field } from '../lib/ui.jsx';
import { computeRoomCharge } from '../../../shared/billing.js';
import { STATIONS } from '../../../shared/billing.js';

export default function Insights({ mode, onNavigate }) {
  return mode === 'reports' ? <Reports /> : <Overview onNavigate={onNavigate} />;
}

/* ------------------------------- overview -------------------------------- */

function Overview({ onNavigate }) {
  const { snapshot, rooms, orders, requests, housekeeping, maintenance, stays, settings } = useApp();
  const now = useNow(1000);

  const occupied = rooms.filter((room) => room.status === 'occupied');
  const outstanding = rooms.reduce((sum, room) => sum + (room.totals?.balance || 0), 0);
  const arrivals = stays.filter((stay) => new Date(stay.check_in_at).toDateString() === new Date().toDateString());
  const newOrders = orders.filter((order) => order.status === 'new');
  const readyOrders = orders.filter((order) => ['ready', 'delivering'].includes(order.status));
  const openTasks = housekeeping.filter((task) => task.status !== 'completed');
  const openIssues = maintenance.filter((issue) => issue.status !== 'resolved');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{dayLong(Date.now())} · {settings.property_line}</div>
          <h1>Good day — here is the hotel right now</h1>
          <p className="page-desc">
            Occupancy, money and the things that need a decision. Everything below is live: the cashier, the stations and the waiter board
            are all feeding this page.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => onNavigate('rooms')}>
            <Icon name="door" size={14} /> Room board
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('reports')}>
            <Icon name="chart" size={14} /> Full reports
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Occupancy" value={snapshot?.occupancy ?? 0} unit="%" icon="building" foot={`${snapshot?.occupied} of ${snapshot?.rooms} rooms sold`} />
        <Stat label="Guests in house" value={snapshot?.activeStays ?? 0} icon="users" foot={`${snapshot?.available} rooms still free today`} />
        <Stat label="Money accruing (room)" value={money(snapshot?.accruedRoomCharges || 0)} icon="banknote" foot="Room bills of guests still in house" />
        <Stat label="Outstanding at the desk" value={money(outstanding)} icon="receipt" alert={outstanding > 40000} foot="To collect before guests leave" />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 18 }}>
        <Card title="Revenue mix · today" subtitle="Posted charges by department">
          <Bars
            rows={[
              { label: 'Rooms', value: snapshot?.accruedRoomCharges || 1, display: money(snapshot?.accruedRoomCharges || 0), tone: 'room' },
              { label: 'Food & drinks', value: 1, display: money(orders.filter((o) => o.charged).reduce((sum, o) => sum + o.total, 0)), tone: 'food' },
              { label: 'Services & other', value: 0.4, display: 'See reports', tone: 'service' },
            ]}
          />
          <div className="banner info" style={{ marginTop: 16 }}>
            <Icon name="chart" size={15} />
            <span>Open <strong>Reports</strong> for the day close: how much cash should be in the drawer, sales per station and the guest list.</span>
          </div>
        </Card>

        <Card title="Needs attention" subtitle="Live queues">
          <div className="stack">
            <QueueRow
              icon="bell"
              tone={newOrders.length ? 'coral' : 'teal'}
              title={`${newOrders.length} order(s) to accept`}
              hint={newOrders.length ? newOrders.map((order) => `#${order.code} → Room ${order.room_number}`).join(' · ') : 'Nothing waiting at the desk'}
              action={newOrders.length ? { label: 'Open orders', onClick: () => onNavigate('orders') } : null}
            />
            <QueueRow
              icon="send"
              tone={readyOrders.length ? 'amber' : 'teal'}
              title={`${readyOrders.length} order(s) to deliver`}
              hint={readyOrders.length ? readyOrders.map((order) => `#${order.code} → Room ${order.room_number}`).join(' · ') : 'All food is in guests’ hands'}
              action={readyOrders.length ? { label: 'Deliveries', onClick: () => onNavigate('deliveries') } : null}
            />
            <QueueRow
              icon="clipboard"
              tone={requests.length ? 'coral' : 'teal'}
              title={`${requests.length} guest registration(s) waiting`}
              hint={requests.length ? requests.map((request) => `${request.payload.full_name} → Room ${request.room_number}`).join(' · ') : 'No self-registrations waiting'}
              action={requests.length ? { label: 'Room board', onClick: () => onNavigate('rooms') } : null}
            />
            <QueueRow
              icon="sparkles"
              tone={openTasks.length ? 'amber' : 'teal'}
              title={`${openTasks.length} room(s) to clean`}
              hint={openTasks.map((task) => `Room ${task.room_number}`).join(' · ') || 'All rooms turned around'}
              action={{ label: 'Housekeeping', onClick: () => onNavigate('housekeeping') }}
            />
            <QueueRow
              icon="wrench"
              tone={openIssues.length ? 'amber' : 'teal'}
              title={`${openIssues.length} maintenance issue(s)`}
              hint={openIssues.map((issue) => `${issue.room_number}: ${issue.issue}`).join(' · ') || 'Nothing broken'}
              action={{ label: 'Maintenance', onClick: () => onNavigate('maintenance') }}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-main">
        <Card
          title="Guests in house"
          subtitle="Live bill including the room that is still counting"
          noBody
          action={<button className="btn btn-sm" onClick={() => onNavigate('stays')}>Manage <Icon name="arrow-right" size={13} /></button>}
        >
          {occupied.length === 0 ? (
            <Empty title="No guests in house" hint="Check a guest in from the room board." icon="users" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Guest</th>
                  <th>Time in room</th>
                  <th>Room charge</th>
                  <th>Food &amp; drinks</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {occupied.map((room) => {
                  const live = computeRoomCharge(room.stay, now);
                  return (
                    <tr key={room.id}>
                      <td><strong>{room.number}</strong><div className="tiny muted">{room.type?.name}</div></td>
                      <td>{room.stay.guest}<div className="tiny muted">{room.stay.phone}</div></td>
                      <td className="small">{formatElapsed(live.elapsedMs)}<div className="tiny muted">next {live.unitLabel} in {Math.round(live.nextUnitInMs / 60000)} min</div></td>
                      <td>{money(room.totals.room)}</td>
                      <td>{money(room.totals.food)}</td>
                      <td><strong>{money(room.totals.balance)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Today’s movement" subtitle={`${snapshot?.arrivalsToday || 0} arrivals · ${snapshot?.departuresToday || 0} departures`}>
          {arrivals.length === 0 ? (
            <Empty title="No arrivals logged today" hint="Check-ins appear here as soon as the desk saves them." icon="calendar" />
          ) : (
            <div className="stack">
              {arrivals.slice(0, 6).map((stay) => (
                <div className="row" key={stay.id} style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <div className="avatar">{stay.guest?.full_name?.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong className="small">{stay.guest?.full_name}</strong>
                      <div className="tiny muted">Room {stay.room_number} · {dateTimeOf(stay.check_in_at)}</div>
                    </div>
                  </div>
                  <span className="pill available"><i />In house</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function QueueRow({ icon, title, hint, tone, action }) {
  const colors = { coral: 'var(--coral-soft)', amber: 'var(--amber-soft)', teal: 'var(--mint)' };
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div className="avatar" style={{ background: colors[tone] || colors.teal }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1 }}>
        <strong className="small">{title}</strong>
        <div className="tiny muted" style={{ marginTop: 3 }}>{hint}</div>
      </div>
      {action ? (
        <button className="btn btn-sm" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------- reports -------------------------------- */

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

function Reports() {
  const { settings, toast } = useApp();
  const [preset, setPreset] = useState('today');
  const [data, setData] = useState(null);
  const [daily, setDaily] = useState(null);
  const [guests, setGuests] = useState([]);
  const [search, setSearch] = useState('');

  const range = useMemo(() => {
    const today = new Date();
    if (preset === 'today') return { from: today.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    if (preset === 'month') return { from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    return { from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
  }, [preset]);

  const load = async () => {
    try {
      const [summary, close] = await Promise.all([
        api.get(`/reports/summary?from=${range.from}&to=${range.to}&days=7`),
        api.get(`/reports/daily?date=${new Date().toISOString().slice(0, 10)}`),
      ]);
      setData(summary);
      setDaily(close);
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const loadGuests = async (term = '') => {
    const result = await api.get(`/reports/guests${term ? `?search=${encodeURIComponent(term)}` : ''}`);
    setGuests(result.guests);
  };

  useEffect(() => {
    load();
    loadGuests();
  }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  useTopic('reports', load);

  if (!data) return <Empty title="Building the report…" hint="One moment." icon="chart" />;
  const { revenue, snapshot, trends } = data;
  const peak = Math.max(1, ...trends.map((day) => day.total));
  const methods = Object.entries(revenue.methods || {});

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Owner’s numbers</div>
          <h1>Reports &amp; daily close</h1>
          <p className="page-desc">
            Where the money came from, what should be in the drawer, which department sold what, and the history of every guest who stayed.
          </p>
        </div>
        <div className="row">
          <Seg value={preset} onChange={setPreset} options={PRESETS} />
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={14} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Revenue in range" value={money(revenue.net)} icon="trending-up" foot={`${range.from} → ${range.to}`} />
        <Stat label="Rooms" value={money(revenue.rooms)} icon="door" foot="Settled room charges" />
        <Stat label="Food & drinks" value={money(revenue.food)} icon="utensils" foot={`${money(revenue.counterSales)} walk-in money`} />
        <Stat label="Money received" value={money(revenue.payments)} icon="banknote" foot={`${money(revenue.discounts)} in discounts`} />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 18 }}>
        <Card title="Last 7 days" subtitle="Rooms · food & drinks · services">
          <div className="columns-chart">
            {trends.map((day) => (
              <div className="col" key={day.date}>
                <div className="stack-bar" style={{ '--h': Math.round((day.total / peak) * 100) }}>
                  <i className="service" style={{ height: `${(day.service / Math.max(1, day.total)) * 100}%` }} />
                  <i className="food" style={{ height: `${(day.food / Math.max(1, day.total)) * 100}%` }} />
                  <i className="room" style={{ height: `${(day.room / Math.max(1, day.total)) * 100}%` }} />
                </div>
                <span>{new Date(day.date).getDate()}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 14, marginTop: 14 }}>
            <span className="row tight tiny"><i className="legend-dot room" style={{ background: 'var(--teal)', width: 10, height: 10, borderRadius: 3, display: 'inline-block' }} /> Rooms</span>
            <span className="row tight tiny"><i style={{ background: 'var(--amber)', width: 10, height: 10, borderRadius: 3, display: 'inline-block' }} /> Food &amp; drinks</span>
            <span className="row tight tiny"><i style={{ background: 'var(--blue)', width: 10, height: 10, borderRadius: 3, display: 'inline-block' }} /> Services</span>
          </div>
        </Card>

        <Card title={`Day close · ${daily?.date || ''}`} subtitle="What the cashier should hand over tonight">
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Expected cash in the drawer</span>
              <strong>{money(daily?.expectedCash || 0)}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Payments recorded today</span>
              <strong>{daily?.payments?.length || 0}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Still outstanding in house</span>
              <strong>{money(daily?.outstanding || 0)}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Occupancy</span>
              <strong>{daily?.occupancy || 0}%</strong>
            </div>
            <div className="banner good">
              <Icon name="check-circle" size={15} />
              <span>The room charge keeps counting until the room is released — so this number always matches the bills.</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Occupancy today" value={snapshot.occupancy} unit="%" icon="building" foot={`${snapshot.occupied} rooms sold`} />
        <Stat label="ADR (rooms)" value={money(snapshot.adr)} icon="trending-up" foot="Average room rate today" />
        <Stat label="RevPAR" value={money(snapshot.revpar)} icon="chart" foot="Room revenue per available room" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <Card title="Payments by method" subtitle="How guests are paying">
          {methods.length === 0 ? (
            <Empty title="No payments in this range" hint="Deposits and settlements appear here." icon="banknote" />
          ) : (
            <Bars rows={methods.map(([method, value]) => ({ label: method, value, display: money(value) }))} />
          )}
        </Card>
        <Card title="Sales by department" subtitle="Food & drinks split per station">
          {Object.keys(revenue.byStation || {}).length === 0 ? (
            <Empty title="No station sales yet" hint="Delivered room-service orders land here." icon="chef-hat" />
          ) : (
            <Bars
              rows={Object.entries(revenue.byStation).map(([station, value]) => ({
                label: STATIONS[station]?.label || station,
                value,
                display: money(value),
                tone: 'food',
              }))}
            />
          )}
        </Card>
      </div>

      <Card
        title="Guest history"
        subtitle="Everyone who ever stayed — search by name or phone"
        action={
          <div className="search" style={{ width: 260 }}>
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadGuests(event.currentTarget.value);
              }}
              placeholder="Search and press Enter"
            />
          </div>
        }
        noBody
      >
        {guests.length === 0 ? (
          <Empty title="No guests found" hint="Try another name or phone number." icon="users" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Stay</th>
                <th>Bill</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.guest}</strong><div className="tiny muted">{row.phone}</div></td>
                  <td>{row.room || '—'}</td>
                  <td className="small">
                    {dateOf(row.check_in_at)} → {row.check_out_at ? dateOf(row.check_out_at) : 'in house'}
                    <div className="tiny muted">{row.billing_mode}</div>
                  </td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.paid)}</td>
                  <td><strong>{money(row.balance)}</strong></td>
                  <td><Pill status={row.status === 'checked_out' ? 'completed' : 'occupied'}>{row.status === 'checked_out' ? 'Checked out' : 'In house'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
