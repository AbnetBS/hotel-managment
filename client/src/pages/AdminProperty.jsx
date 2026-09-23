import { useState } from 'react';
import { api, uploadPhoto } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { Card, Field, Modal, Empty, Pill } from '../lib/ui.jsx';
import { BILLING_MODES } from '../../../shared/billing.js';

/** Rooms, room types, photos and prices — the admin's building block. */
export default function AdminProperty() {
  const { rooms, roomTypes, toast, loadRooms, loadRoomTypes } = useApp();
  const [tab, setTab] = useState('types');
  const [editing, setEditing] = useState(null);
  const [newRoom, setNewRoom] = useState(false);

  const refresh = async () => {
    await loadRoomTypes();
    await loadRooms();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Property setup</div>
          <h1>Rooms &amp; photos</h1>
          <p className="page-desc">
            The pictures and description here are exactly what the cashier shows a guest at the desk, and what a guest sees after scanning the
            QR code. Prices drive every bill in the hotel.
          </p>
        </div>
        <div className="row">
          <div className="seg">
            <button className={tab === 'types' ? 'on' : ''} onClick={() => setTab('types')}>Room types &amp; photos</button>
            <button className={tab === 'rooms' ? 'on' : ''} onClick={() => setTab('rooms')}>Room list</button>
          </div>
          {tab === 'types' ? (
            <button className="btn btn-primary" onClick={() => setEditing({ billing_mode: 'nightly', photos: [], amenities: [], max_guests: 2, dayuse_hours: 3 })}>
              <Icon name="plus" size={15} /> New room type
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setNewRoom(true)}>
              <Icon name="plus" size={15} /> New room
            </button>
          )}
        </div>
      </div>

      {tab === 'types' ? (
        <div className="grid grid-2">
          {roomTypes.map((type) => (
            <Card key={type.id} noBody>
              <div className="gallery" style={{ borderRadius: '14px 14px 0 0', aspectRatio: '16/7' }}>
                {type.photos?.[0] ? <img src={type.photos[0]} alt={type.name} /> : <div className="empty">No photo yet</div>}
              </div>
              <div className="card-body">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3>{type.name}</h3>
                    <div className="tiny muted">{type.beds} · up to {type.max_guests} guest(s) · {BILLING_MODES[type.billing_mode]?.label}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>{money(type.nightly_rate)}</strong>
                    <div className="tiny muted">per night</div>
                  </div>
                </div>
                <p className="small muted" style={{ marginTop: 10, lineHeight: 1.6 }}>{type.description}</p>
                <div className="chips" style={{ marginTop: 10 }}>
                  {(type.amenities || []).slice(0, 5).map((item) => <span className="chip" key={item}>{item}</span>)}
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <label className="btn btn-sm">
                    <Icon name="upload" size={13} /> Add photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const { url } = await uploadPhoto(file);
                          await api.patch(`/admin/room-types/${type.id}`, { photos: [...(type.photos || []), url] });
                          toast('Photo added — guests and the desk see it now.');
                          refresh();
                        } catch (error) {
                          toast(error.message, 'error');
                        }
                      }}
                    />
                  </label>
                  <button className="btn btn-sm" onClick={() => setEditing({ ...type })}>
                    <Icon name="pencil" size={13} /> Edit details &amp; price
                  </button>
                  {type.photos?.length > 1 ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={async () => {
                        await api.patch(`/admin/room-types/${type.id}`, { photos: type.photos.slice(0, -1) });
                        refresh();
                      }}
                    >
                      <Icon name="trash" size={13} /> Remove last photo
                    </button>
                  ) : null}
                </div>
                <div className="row tight" style={{ marginTop: 10 }}>
                  {(type.photos || []).map((photo) => (
                    <img key={photo} src={photo} alt="" style={{ width: 54, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card title="All rooms" subtitle={`${rooms.length} rooms in the hotel`} noBody>
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Billing</th>
                <th>Status</th>
                <th>Guest</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td><strong>Room {room.number}</strong></td>
                  <td>{room.floor}</td>
                  <td>{room.type?.name}</td>
                  <td className="small">{BILLING_MODES[room.billing_mode]?.label}</td>
                  <td><Pill status={room.status}>{room.status}</Pill></td>
                  <td className="small muted">{room.stay?.guest || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          const status = window.prompt(`New status for Room ${room.number} (available, cleaning, dirty, maintenance, reserved)`, room.status);
                          if (!status) return;
                          try {
                            await api.post(`/rooms/${room.id}/status`, { status });
                            toast(`Room ${room.number} is now ${status}.`);
                            refresh();
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        }}
                      >
                        Status
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        title="New QR code for the room"
                        onClick={async () => {
                          await api.patch(`/admin/rooms/${room.id}`, { regenerate_qr: true });
                          toast('New QR code created — print the QR sheet again.');
                          refresh();
                        }}
                      >
                        <Icon name="qr" size={13} />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={async () => {
                          if (!window.confirm(`Delete Room ${room.number}?`)) return;
                          try {
                            await api.del(`/admin/rooms/${room.id}`);
                            toast('Room deleted.');
                            refresh();
                          } catch (error) {
                            toast(error.message, 'error');
                          }
                        }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing ? <RoomTypeModal value={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} /> : null}
      {newRoom ? <NewRoomModal roomTypes={roomTypes} onClose={() => setNewRoom(false)} onDone={() => { setNewRoom(false); refresh(); }} /> : null}
    </>
  );
}

function RoomTypeModal({ value, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({
    ...value,
    amenitiesText: (value.amenities || []).join(', '),
  });
  const set = (key) => (fieldValue) => setForm((current) => ({ ...current, [key]: fieldValue }));

  const submit = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      billing_mode: form.billing_mode,
      nightly_rate: Number(form.nightly_rate) || 0,
      hourly_rate: Number(form.hourly_rate) || 0,
      dayuse_rate: Number(form.dayuse_rate) || 0,
      dayuse_hours: Number(form.dayuse_hours) || 3,
      max_guests: Number(form.max_guests) || 2,
      beds: form.beds,
      amenities: String(form.amenitiesText || '').split(',').map((item) => item.trim()).filter(Boolean),
    };
    try {
      if (value.id) await api.patch(`/admin/room-types/${value.id}`, payload);
      else await api.post('/admin/room-types', payload);
      toast(value.id ? 'Room type updated — new prices apply to new stays.' : 'Room type created.');
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <Modal
      title={value.id ? `Edit ${value.name}` : 'New room type'}
      subtitle="Prices and description used on the desk and on the guest QR page"
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!form.name}>
            <Icon name="check" size={15} /> Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" required>
          <input value={form.name || ''} onChange={(event) => set('name')(event.target.value)} placeholder="e.g. Deluxe king" />
        </Field>
        <Field label="Beds">
          <input value={form.beds || ''} onChange={(event) => set('beds')(event.target.value)} placeholder="1 king bed" />
        </Field>
        <Field label="How is it billed by default?">
          <select value={form.billing_mode} onChange={(event) => set('billing_mode')(event.target.value)}>
            {Object.values(BILLING_MODES).map((mode) => (
              <option key={mode.key} value={mode.key}>{mode.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Max guests">
          <input type="number" value={form.max_guests || ''} onChange={(event) => set('max_guests')(event.target.value)} />
        </Field>
        <Field label="Rate per night (ETB)" required>
          <input type="number" value={form.nightly_rate || ''} onChange={(event) => set('nightly_rate')(event.target.value)} />
        </Field>
        <Field label="Rate per hour (ETB)" hint="Used when a guest takes the room hourly.">
          <input type="number" value={form.hourly_rate || ''} onChange={(event) => set('hourly_rate')(event.target.value)} />
        </Field>
        <Field label="Day-use rate (ETB)">
          <input type="number" value={form.dayuse_rate || ''} onChange={(event) => set('dayuse_rate')(event.target.value)} />
        </Field>
        <Field label="Day-use block (hours)">
          <input type="number" value={form.dayuse_hours || ''} onChange={(event) => set('dayuse_hours')(event.target.value)} />
        </Field>
        <Field label="Description shown to guests" full>
          <textarea value={form.description || ''} onChange={(event) => set('description')(event.target.value)} />
        </Field>
        <Field label="What is in the room?" hint="Comma separated — Wi-Fi, hot shower, balcony…" full>
          <input value={form.amenitiesText} onChange={(event) => set('amenitiesText')(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function NewRoomModal({ roomTypes, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ number: '', floor: 1, room_type_id: roomTypes[0]?.id || '', billing_mode: '', status: 'available' });
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      title="New room"
      subtitle="A room gets its own QR code automatically."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.number}
            onClick={async () => {
              try {
                await api.post('/admin/rooms', { ...form, billing_mode: form.billing_mode || null });
                toast(`Room ${form.number} added.`);
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="plus" size={15} /> Add room
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Room number" required>
          <input value={form.number} onChange={(event) => set('number')(event.target.value)} placeholder="e.g. 401" />
        </Field>
        <Field label="Floor">
          <input type="number" value={form.floor} onChange={(event) => set('floor')(event.target.value)} />
        </Field>
        <Field label="Room type">
          <select value={form.room_type_id} onChange={(event) => set('room_type_id')(event.target.value)}>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name} · {money(type.nightly_rate)}</option>
            ))}
          </select>
        </Field>
        <Field label="Own billing mode?" hint="Leave as the type default, or force hourly for this room.">
          <select value={form.billing_mode} onChange={(event) => set('billing_mode')(event.target.value)}>
            <option value="">Use the room type default</option>
            {Object.values(BILLING_MODES).map((mode) => (
              <option key={mode.key} value={mode.key}>{mode.label}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
