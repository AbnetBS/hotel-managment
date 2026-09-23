import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { relative } from '../lib/format.js';
import { Stat, Empty, Card, Modal, Field, Pill } from '../lib/ui.jsx';

const STATUS_LABEL = { 'in progress': 'Cleaning now', pending: 'Waiting', completed: 'Finished' };

/** The maintenance ladder: reported → assigned → being fixed → fixed → signed off. */
const FLOW = {
  open: { next: 'assigned', label: 'Assign', icon: 'users', hint: 'Who is going to fix it?' },
  assigned: { next: 'in progress', label: 'Start the job', icon: 'play', hint: 'The technician has started work.' },
  'in progress': { next: 'fixed', label: 'Mark fixed', icon: 'check', hint: 'What did the repair cost?' },
  fixed: { next: 'verified', label: 'Check and sign off', icon: 'check-circle', hint: 'You have looked at it yourself — the room goes for cleaning.' },
  verified: null,
  resolved: null,
};
const FLOW_LABEL = { open: 'Reported', assigned: 'Assigned', 'in progress': 'Being fixed', fixed: 'Fixed · waiting for check', verified: 'Verified', resolved: 'Done' };

export default function Tasks({ mode }) {
  const { housekeeping, maintenance, rooms, toast, loadHousekeeping, loadMaintenance, loadRooms } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('open');
  const [moving, setMoving] = useState(null); // the ticket being moved along
  const [history, setHistory] = useState(null); // repeat-problem history for one room

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
            <div className="eyebrow">Rooms to turn around · የጽዳት ሥራ</div>
            <h1>Housekeeping</h1>
            <p className="page-desc">
              Rooms waiting for you are <strong>purple</strong>. Tap <strong>Start cleaning</strong> when you go in (the room turns blue), then
              <strong> Cleaned · ንጹህ ሆነ</strong> when you finish — the room turns green for the next guest.
            </p>
          </div>
          <button className="btn" onClick={() => { loadHousekeeping(); loadRooms(); }}>
            <Icon name="rotate-ccw" size={14} /> Refresh
          </button>
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <Stat label="Rooms to clean" value={dirtyRooms.length} icon="broom" alert={dirtyRooms.length > 0} foot="Purple on the desk board" />
          <Stat label="Open tasks" value={openTasks.length} icon="sparkles" foot="Across all floors" />
          <Stat label="Finished today" value={housekeeping.filter((task) => task.status === 'completed').length} icon="check-circle" foot="Released back to the desk" />
        </div>

        {openTasks.length ? (
          <div className="hk-board">
            {openTasks.map((task) => {
              const room = rooms.find((item) => item.id === task.room_id);
              const started = task.status === 'in progress' || room?.status === 'cleaning';
              return (
                <div className={`hk-card ${started ? 'working' : ''}`} key={task.id}>
                  <div className="hk-room">{room?.number || task.room_number}</div>
                  <div className="hk-type">{task.type}</div>
                  <div className="hk-note">{task.note}</div>
                  <div className="hk-meta">
                    <Pill status={task.priority}>{task.priority}</Pill>
                    <span className="tiny muted">{relative(task.created_at)}</span>
                  </div>
                  <button
                    className="btn btn-lg btn-primary btn-block"
                    onClick={async () => {
                      try {
                        const result = await api.post(`/housekeeping/${task.id}/advance`);
                        toast(result.status === 'completed'
                          ? `Room ${result.room || room?.number} is clean · ክፍሉ ተጠናቋል`
                          : `Room ${result.room || room?.number} · cleaning started`);
                        loadHousekeeping();
                        loadRooms();
                      } catch (error) {
                        toast(error.message, 'error');
                      }
                    }}
                  >
                    <Icon name={started ? 'check' : 'play'} size={18} />
                    {started ? 'Cleaned · ንጹህ ሆነ' : 'Start cleaning · ጀምር'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <Card title="Cleaning tasks" subtitle="Nothing to do right now" noBody>
            <Empty title="All rooms are clean" hint="A card appears here the moment a guest checks out and pays." icon="sparkles" />
          </Card>
        )}

        <Card title="Finished today" subtitle="Kept for the supervisor" noBody>
          {housekeeping.filter((task) => task.status === 'completed').length === 0 ? (
            <Empty title="Nothing finished yet" hint="Completed rooms appear here with the time." icon="check-circle" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Task</th>
                  <th>Finished</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {housekeeping.filter((task) => task.status === 'completed').map((task) => (
                  <tr key={task.id}>
                    <td><strong>Room {task.room_number}</strong></td>
                    <td>{task.type}</td>
                    <td className="small muted">{relative(task.completed_at)}</td>
                    <td className="small muted">{task.note || '—'}</td>
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
            A high-priority problem blocks the room so the desk cannot sell it. Walk the ticket up the ladder —
            <strong> assign → start → fixed → sign off</strong>. A signed-off repair sends the room for cleaning before it is sold again.
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
                  <td>
                    <Pill status={issue.status.replace(' ', '-')}>{FLOW_LABEL[issue.status] || issue.status}</Pill>
                    {issue.cost ? <div className="tiny muted">{issue.cost} birr</div> : null}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="icon-btn"
                        title="Has this room had the same problem before?"
                        onClick={async () => {
                          try {
                            setHistory({ room: issue.room_number, ...(await api.get(`/maintenance/history/${issue.room_id}`)) });
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        }}
                      >
                        <Icon name="clock" size={14} />
                      </button>
                      {FLOW[issue.status] ? (
                        <button className="btn btn-sm btn-primary" onClick={() => setMoving(issue)}>
                          <Icon name={FLOW[issue.status].icon} size={13} /> {FLOW[issue.status].label}
                        </button>
                      ) : (
                        <span className="tiny muted">Closed</span>
                      )}
                    </div>
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

      {moving ? (
        <MoveIssueModal
          issue={moving}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null);
            loadMaintenance();
            loadRooms();
          }}
        />
      ) : null}

      {history ? (
        <Modal
          title={`Room ${history.room} · repair history`}
          subtitle={history.repeat ? 'This room keeps coming back — worth a proper look.' : 'Nothing repeated here.'}
          onClose={() => setHistory(null)}
          footer={<button className="btn" onClick={() => setHistory(null)}>Close</button>}
        >
          <div className="stack">
            <div className="grid grid-3">
              <Stat label="Times reported" value={history.total} icon="wrench" foot={history.repeat ? 'Repeated problem' : 'One-off'} />
              <Stat label="All-time repair cost" value={`${history.cost || 0}`} icon="banknote" foot="Birr spent on this room" />
              <Stat label="Most common" value={history.top_category || '—'} icon="alert" foot="Category that keeps coming back" />
            </div>
            <Card title="Every ticket" subtitle="Newest first" noBody>
              <table>
                <thead>
                  <tr><th>Issue</th><th>Category</th><th>Reported</th><th>Status</th><th>Cost</th></tr>
                </thead>
                <tbody>
                  {history.issues.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.issue}</strong></td>
                      <td>{row.category}</td>
                      <td className="small muted">{relative(row.created_at)}</td>
                      <td><Pill status={String(row.status).replace(' ', '-')}>{FLOW_LABEL[row.status] || row.status}</Pill></td>
                      <td>{row.cost ? `${row.cost} birr` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** One step up the maintenance ladder, with only the fields that step needs. */
function MoveIssueModal({ issue, onClose, onDone }) {
  const { toast } = useApp();
  const step = FLOW[issue.status];
  const [assignee, setAssignee] = useState(issue.assignee && issue.assignee !== 'Unassigned' ? issue.assignee : '');
  const [cost, setCost] = useState(issue.cost || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/maintenance/${issue.id}/move`, {
        status: step.next,
        assignee: assignee || undefined,
        cost: cost === '' ? undefined : Number(cost),
        note: note || undefined,
      });
      toast(
        step.next === 'verified'
          ? `Signed off — Room ${issue.room_number} goes to housekeeping before it is sold again.`
          : `Room ${issue.room_number}: ${FLOW_LABEL[step.next]}.`,
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
      title={`${issue.issue}`}
      subtitle={`Room ${issue.room_number} · ${FLOW_LABEL[issue.status]} → ${FLOW_LABEL[step.next]}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            <Icon name={step.icon} size={15} /> {step.label}
          </button>
        </>
      }
    >
      <p className="small muted" style={{ marginBottom: 14 }}>{step.hint}</p>
      <div className="form-grid">
        {['assigned', 'in progress'].includes(step.next) ? (
          <Field label="Handled by" full>
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Technician name" />
          </Field>
        ) : null}
        {step.next === 'fixed' ? (
          <Field label="Cost of the repair (birr)" hint="Parts and labour — it is kept with the ticket." full>
            <input type="number" min="0" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0" />
          </Field>
        ) : null}
        <Field label="Note (optional)" full>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was done?" />
        </Field>
      </div>
    </Modal>
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
