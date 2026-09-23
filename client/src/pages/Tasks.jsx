import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { relative } from '../lib/format.js';
import { Stat, Empty, Card, Modal, Field, Pill } from '../lib/ui.jsx';

const STATUS_LABEL = { 'in progress': 'Cleaning now', pending: 'Waiting', completed: 'Finished' };

export default function Tasks({ mode }) {
  const { housekeeping, maintenance, rooms, toast, loadHousekeeping, loadMaintenance, loadRooms } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('open');

  const openTasks = housekeeping.filter((task) => task.status !== 'completed');
  const dirtyRooms = rooms.filter((room) => ['dirty', 'cleaning'].includes(room.status));

  const issues = useMemo(
    () => (filter === 'open' ? maintenance.filter((issue) => issue.status !== 'resolved') : maintenance),
    [maintenance, filter],
  );

  if (mode === 'housekeeping') {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Rooms to turn around</div>
            <h1>Housekeeping</h1>
            <p className="page-desc">
              Every checkout drops a task here automatically. Tap <strong>Start</strong>, then <strong>Finished</strong> — the moment you finish,
              the room turns green on the cashier board and can take the next guest.
            </p>
          </div>
          <button className="btn" onClick={loadHousekeeping}>
            <Icon name="rotate-ccw" size={14} /> Refresh
          </button>
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <Stat label="Rooms waiting" value={dirtyRooms.length} icon="door" alert={dirtyRooms.length > 0} foot="Dirty or half-cleaned" />
          <Stat label="Open tasks" value={openTasks.length} icon="sparkles" foot="Across all floors" />
          <Stat label="Finished today" value={housekeeping.filter((task) => task.status === 'completed').length} icon="check-circle" foot="Released back to the desk" />
        </div>

        <Card title="Cleaning tasks" subtitle="Newest first" noBody>
          {housekeeping.length === 0 ? (
            <Empty title="No cleaning tasks" hint="A task appears here as soon as a guest checks out." icon="sparkles" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Task</th>
                  <th>Priority</th>
                  <th>Note</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {housekeeping.map((task) => (
                  <tr key={task.id}>
                    <td><strong>Room {task.room_number}</strong></td>
                    <td>{task.type}</td>
                    <td><Pill status={task.priority}>{task.priority}</Pill></td>
                    <td className="small muted">{task.note || '—'}</td>
                    <td className="small muted">{relative(task.created_at)}</td>
                    <td><Pill status={task.status.replace(' ', '-')}>{STATUS_LABEL[task.status] || task.status}</Pill></td>
                    <td style={{ textAlign: 'right' }}>
                      {task.status !== 'completed' ? (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={async () => {
                            try {
                              const result = await api.post(`/housekeeping/${task.id}/advance`);
                              toast(result.status === 'completed' ? `Room ${task.room_number} is clean and free.` : `Room ${task.room_number} · cleaning started.`);
                              loadHousekeeping();
                              loadRooms();
                            } catch (error) {
                              toast(error.message, 'error');
                            }
                          }}
                        >
                          <Icon name={task.status === 'pending' ? 'play' : 'check'} size={13} />
                          {task.status === 'pending' ? 'Start' : 'Finished'}
                        </button>
                      ) : (
                        <span className="tiny muted">Released</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Broken things, fixed fast</div>
          <h1>Maintenance</h1>
          <p className="page-desc">
            A high-priority problem automatically blocks the room so the desk cannot sell it. When it is fixed and the room is cleared, tap
            <strong> Resolve</strong> — the room goes back on sale.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}>
            <Icon name="filter" size={14} /> {filter === 'open' ? 'Show resolved' : 'Show open only'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={15} /> Report a problem
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Open issues" value={maintenance.filter((issue) => issue.status !== 'resolved').length} icon="wrench" alert={maintenance.filter((issue) => issue.status !== 'resolved').length > 0} foot="Reported by staff or guests" />
        <Stat label="Rooms blocked" value={rooms.filter((room) => room.status === 'maintenance').length} icon="door" foot="Not sellable right now" />
        <Stat label="Resolved" value={maintenance.filter((issue) => issue.status === 'resolved').length} icon="check-circle" foot="In the log" />
      </div>

      <Card title="Issue log" subtitle="Newest first" noBody>
        {issues.length === 0 ? (
          <Empty title="Nothing broken" hint="Report a problem and it lands here with the room blocked." icon="wrench" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Room</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Reported</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <strong>{issue.issue}</strong>
                    <div className="tiny muted">{issue.id}</div>
                  </td>
                  <td><strong>Room {issue.room_number}</strong></td>
                  <td>{issue.category}</td>
                  <td><Pill status={issue.priority}>{issue.priority}</Pill></td>
                  <td className="small muted">{relative(issue.created_at)}</td>
                  <td><Pill status={issue.status.replace(' ', '-')}>{issue.status}</Pill></td>
                  <td style={{ textAlign: 'right' }}>
                    {issue.status !== 'resolved' ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={async () => {
                          try {
                            await api.post(`/maintenance/${issue.id}/resolve`);
                            toast(`Fixed — Room ${issue.room_number} is back on sale.`);
                            loadMaintenance();
                            loadRooms();
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        }}
                      >
                        <Icon name="check" size={13} /> Resolve
                      </button>
                    ) : (
                      <span className="tiny muted">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showNew ? (
        <NewIssueModal
          rooms={rooms}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            loadMaintenance();
            loadRooms();
          }}
        />
      ) : null}
    </>
  );
}

function NewIssueModal({ rooms, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ room_id: '', issue: '', category: 'General', priority: 'normal', assignee: '' });
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      title="Report a problem"
      subtitle="A high-priority issue blocks the room automatically."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.issue}
            onClick={async () => {
              try {
                await api.post('/maintenance', form);
                toast('Problem logged. The technician will see it on the maintenance board.');
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="wrench" size={15} /> Log it
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Room" required>
          <select value={form.room_id} onChange={(event) => set('room_id')(event.target.value)}>
            <option value="">Choose…</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>Room {room.number}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(event) => set('category')(event.target.value)}>
            {['General', 'Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Electronics', 'TV & internet'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority" hint="High blocks the room straight away.">
          <select value={form.priority} onChange={(event) => set('priority')(event.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High — block the room</option>
          </select>
        </Field>
        <Field label="Handled by">
          <input value={form.assignee} onChange={(event) => set('assignee')(event.target.value)} placeholder="Technician name" />
        </Field>
        <Field label="What is wrong?" required full>
          <input value={form.issue} onChange={(event) => set('issue')(event.target.value)} placeholder="e.g. Shower has no hot water" />
        </Field>
      </div>
    </Modal>
  );
}
