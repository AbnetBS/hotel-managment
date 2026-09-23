import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { relative } from '../lib/format.js';
import { Card, Empty, Stat, Pill } from '../lib/ui.jsx';

/** Which department a role is responsible for. */
const MY_DEPARTMENT = {
  housekeeping: 'housekeeping',
  maintenance: 'maintenance',
  waiter: 'waiter',
  cashier: 'all',
  manager: 'all',
  admin: 'all',
};

const DEPARTMENTS = [
  { key: 'all', label: 'Everything' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'waiter', label: 'Service' },
  { key: 'desk', label: 'Reception' },
];

/**
 * What guests ask for from the room — towels, water, laundry, a taxi, "the AC
 * is broken". One board, filtered to the department that owns each request.
 */
export default function Requests() {
  const { user, guestRequests, toast, loadGuestRequests } = useApp();
  const mine = MY_DEPARTMENT[user?.role] || 'all';
  const [filter, setFilter] = useState(mine === 'all' ? 'all' : mine);
  const [busyId, setBusyId] = useState('');

  const visible = useMemo(
    () => guestRequests.filter((request) => (filter === 'all' ? true : request.department === filter)),
    [guestRequests, filter],
  );
  const open = visible.filter((request) => request.status !== 'done');
  const waiting = open.filter((request) => Date.now() - new Date(request.created_at).getTime() > 15 * 60 * 1000);

  const advance = async (request) => {
    setBusyId(request.id);
    try {
      const result = await api.post(`/requests/${request.id}/advance`, {});
      toast(
        result.status === 'done'
          ? `Room ${request.room_number} · ${request.label} done.`
          : `Room ${request.room_number} · on the way.`,
      );
      loadGuestRequests();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Straight from the room · ከክፍል የመጡ ጥያቄዎች</div>
          <h1>Guest requests</h1>
          <p className="page-desc">
            Guests tap what they need on the QR code. Each request lands here for the department that owns it —
            tap <strong>Accept</strong> when you are going, then <strong>Done</strong> when it is delivered.
          </p>
        </div>
        <button className="btn" onClick={() => loadGuestRequests()}>
          <Icon name="rotate-ccw" size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Waiting" value={open.filter((r) => r.status === 'new').length} icon="bell" alert={open.some((r) => r.status === 'new')} foot="Nobody has picked them up yet" />
        <Stat label="On the way" value={open.filter((r) => r.status === 'accepted').length} icon="send" foot="Someone is handling it" />
        <Stat label="Waiting over 15 min" value={waiting.length} icon="alert" alert={waiting.length > 0} foot="A guest is still waiting" />
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="seg">
          {DEPARTMENTS.filter((department) => mine === 'all' || department.key === mine || department.key === 'all').map((department) => (
            <button key={department.key} className={filter === department.key ? 'on' : ''} onClick={() => setFilter(department.key)}>
              {department.label}
            </button>
          ))}
        </div>
      </div>

      {open.length === 0 ? (
        <Empty title="Nothing asked for right now" hint="When a guest taps the QR code in their room, the request arrives here." icon="bell" />
      ) : (
        <Card title="Open requests" subtitle="Oldest first — the guest is counting the minutes" noBody>
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>What</th>
                <th>Note</th>
                <th>Department</th>
                <th>Waiting</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...open].reverse().map((request) => {
                const late = Date.now() - new Date(request.created_at).getTime() > 15 * 60 * 1000;
                return (
                  <tr key={request.id} style={late ? { background: '#fff7f5' } : undefined}>
                    <td><strong>Room {request.room_number}</strong><div className="tiny muted">{request.guest_name}</div></td>
                    <td>
                      <strong>{request.label}</strong>
                      <div className="tiny muted">{request.am}</div>
                    </td>
                    <td className="small">{request.note || '—'}</td>
                    <td className="small muted">{request.department}</td>
                    <td className="small muted">{relative(request.created_at)}</td>
                    <td><Pill status={request.status === 'accepted' ? 'open' : 'reserved'}>{request.status === 'accepted' ? 'on the way' : 'new'}</Pill></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" disabled={busyId === request.id} onClick={() => advance(request)}>
                        <Icon name={request.status === 'new' ? 'check' : 'check-circle'} size={13} />
                        {request.status === 'new' ? 'Accept' : 'Done'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {visible.filter((request) => request.status === 'done').length ? (
        <Card title="Finished in the last hours" subtitle="For the record" noBody>
          <table>
            <thead>
              <tr><th>Room</th><th>What</th><th>Note</th><th>Handled by</th><th>Finished</th></tr>
            </thead>
            <tbody>
              {visible
                .filter((request) => request.status === 'done')
                .slice(0, 20)
                .map((request) => (
                  <tr key={request.id}>
                    <td><strong>Room {request.room_number}</strong></td>
                    <td>{request.label}</td>
                    <td className="small muted">{request.note || '—'}</td>
                    <td className="small muted">{request.handled_by || '—'}</td>
                    <td className="small muted">{relative(request.handled_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}
