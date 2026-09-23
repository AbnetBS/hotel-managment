import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useTopic } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { relative } from '../lib/format.js';
import { Card, Empty, Field, Modal, Pill, Stat } from '../lib/ui.jsx';

/**
 * Lost & found. The housekeeper who finds a charger in Room 203 writes it down
 * once; when the guest calls three weeks later, the desk can find it in seconds
 * and see who returned what.
 */
export default function LostFound() {
  const { rooms, toast } = useApp();
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [returning, setReturning] = useState(null);
  const [filter, setFilter] = useState('stored');

  const load = useCallback(async () => {
    try {
      setItems((await api.get('/lost-found')).items);
    } catch (error) {
      toast(error.message, 'error');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useTopic('lostfound', load);

  const visible = items.filter((item) => (filter === 'all' ? true : item.status === filter));
  const stored = items.filter((item) => item.status === 'stored');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Found around the hotel · የጠፉ እቃዎች</div>
          <h1>Lost &amp; found</h1>
          <p className="page-desc">
            Every item found in a room or a public area is written here with the shelf it sits on — so a phone call
            three weeks later takes seconds, not a walk to the store room.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load}><Icon name="rotate-ccw" size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Log an item
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="On the shelf" value={stored.length} icon="box" foot="Waiting for an owner" />
        <Stat label="Returned" value={items.filter((item) => item.status === 'returned').length} icon="check-circle" foot="Back with the guest" />
        <Stat label="Thrown away" value={items.filter((item) => item.status === 'disposed').length} icon="trash" foot="Kept too long" />
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="seg">
          {[['stored', 'On the shelf'], ['returned', 'Returned'], ['disposed', 'Thrown away'], ['all', 'Everything']].map(([key, label]) => (
            <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty title="Nothing here" hint="Log what the housekeepers bring down from the rooms." icon="box" />
      ) : (
        <Card title="Items" subtitle="Newest first" noBody>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Found where</th>
                <th>Found by</th>
                <th>Stored at</th>
                <th>Guest</th>
                <th>When</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.item}</strong>
                    {item.description ? <div className="tiny muted">{item.description}</div> : null}
                  </td>
                  <td className="small">{item.location || '—'}</td>
                  <td className="small muted">{item.found_by || '—'}</td>
                  <td className="small muted">{item.storage || '—'}</td>
                  <td className="small">{item.guest_name || '—'}</td>
                  <td className="small muted">{relative(item.found_at)}</td>
                  <td>
                    <Pill status={item.status === 'stored' ? 'reserved' : item.status === 'returned' ? 'available' : 'out_of_order'}>
                      {item.status === 'stored' ? 'on the shelf' : item.status}
                    </Pill>
                    {item.returned_to ? <div className="tiny muted">to {item.returned_to}</div> : null}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.status === 'stored' ? (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => setReturning(item)}>
                          <Icon name="check" size={13} /> Returned
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          title="Nothing came of it — throw it away"
                          onClick={async () => {
                            try {
                              await api.post(`/lost-found/${item.id}`, { status: 'disposed' });
                              toast('Item removed from the shelf.');
                              load();
                            } catch (error) {
                              toast(error.message, 'error');
                            }
                          }}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="tiny muted">{item.returned_at ? relative(item.returned_at) : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {adding ? <AddModal rooms={rooms} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} /> : null}
      {returning ? <ReturnModal item={returning} onClose={() => setReturning(null)} onDone={() => { setReturning(null); load(); }} /> : null}
    </>
  );
}

function AddModal({ rooms, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ item: '', description: '', location: '', roomId: '', storage: '', foundBy: '', guestName: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal
      title="Log a found item"
      subtitle="Write it down while you still remember where it was found"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.item}
            onClick={async () => {
              try {
                await api.post('/lost-found', { ...form, roomId: form.roomId || undefined, location: form.location || undefined });
                toast('Logged. Anyone at the desk can now find it.');
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
        <Field label="What is it?" required><input value={form.item} onChange={set('item')} placeholder="Phone charger" autoFocus /></Field>
        <Field label="Description"><input value={form.description} onChange={set('description')} placeholder="White USB-C charger" /></Field>
        <Field label="Found in room" hint="Leave empty for the lobby, restaurant or terrace">
          <select value={form.roomId} onChange={set('roomId')}>
            <option value="">Not a room</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>Room {room.number}</option>)}
          </select>
        </Field>
        <Field label="Area"><input value={form.location} onChange={set('location')} placeholder="Room 203 bedside / Lobby sofa" /></Field>
        <Field label="Found by"><input value={form.foundBy} onChange={set('foundBy')} placeholder="Housekeeper name" /></Field>
        <Field label="Guest (if known)"><input value={form.guestName} onChange={set('guestName')} placeholder="optional" /></Field>
        <Field label="Stored at" hint="Write the exact shelf so anyone can fetch it" full>
          <input value={form.storage} onChange={set('storage')} placeholder="Shelf A · box 2" />
        </Field>
      </div>
    </Modal>
  );
}

function ReturnModal({ item, onClose, onDone }) {
  const { toast } = useApp();
  const [name, setName] = useState(item.guest_name || '');
  const [storage, setStorage] = useState(item.storage || '');

  return (
    <Modal
      title={`Return “${item.item}”`}
      subtitle="Who took it, and from where — so the record is complete"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await api.post(`/lost-found/${item.id}`, { status: 'returned', returnedTo: name || 'Guest', storage });
                toast('Marked as returned.');
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="check" size={15} /> Confirm
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Returned to" full><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Guest name or staff name" autoFocus /></Field>
        <Field label="Storage place" full><input value={storage} onChange={(event) => setStorage(event.target.value)} placeholder="Shelf A · box 2" /></Field>
      </div>
    </Modal>
  );
}
