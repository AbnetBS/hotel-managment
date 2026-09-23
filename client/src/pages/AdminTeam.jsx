import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon, ROLE_ICON } from '../lib/icons.jsx';
import { relative } from '../lib/format.js';
import { Card, Field, Modal, Empty, Pill } from '../lib/ui.jsx';
import { ROLES } from '../../../shared/billing.js';

export default function AdminTeam({ mode }) {
  return mode === 'form' ? <FormBuilder /> : <Staff />;
}

/* --------------------------------- staff --------------------------------- */

function Staff() {
  const { toast } = useApp();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => setUsers((await api.get('/admin/users')).users);

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">People &amp; permissions</div>
          <h1>Staff &amp; access</h1>
          <p className="page-desc">
            A cashier sees rooms and bills. A kitchen user only sees food tickets. Roles are enforced by the server, not just hidden in the menu.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ role: 'cashier', active: true })}>
          <Icon name="user-plus" size={15} /> Add staff member
        </button>
      </div>

      <Card title="Accounts" subtitle={`${users.filter((user) => user.active).length} active`} noBody>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Last sign in</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong></td>
                <td className="small mono">{user.username}</td>
                <td>
                  <span className="row tight">
                    <Icon name={ROLE_ICON[user.role] || 'user'} size={14} />
                    {ROLES[user.role]?.label || user.role}
                  </span>
                </td>
                <td className="small muted">{user.phone || '—'}</td>
                <td className="small muted">{user.last_login_at ? relative(user.last_login_at) : 'never'}</td>
                <td><Pill status={user.active ? 'available' : 'cancelled'}>{user.active ? 'Active' : 'Disabled'}</Pill></td>
                <td style={{ textAlign: 'right' }}>
                  <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm" onClick={() => setEditing(user)}>Edit</button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={async () => {
                        await api.patch(`/admin/users/${user.id}`, { active: !user.active });
                        toast(user.active ? `${user.name} can no longer sign in.` : `${user.name} can sign in again.`);
                        load();
                      }}
                    >
                      {user.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing ? <StaffModal value={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} /> : null}
    </>
  );
}

function StaffModal({ value, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ ...value, pin: '' });
  const set = (key) => (fieldValue) => setForm((current) => ({ ...current, [key]: fieldValue }));

  return (
    <Modal
      title={value.id ? `Edit ${value.name}` : 'Add staff member'}
      subtitle="They sign in with their username and a 4-digit PIN."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                if (value.id) await api.patch(`/admin/users/${value.id}`, { name: form.name, role: form.role, phone: form.phone, username: form.username, pin: form.pin || undefined });
                else await api.post('/admin/users', { name: form.name, role: form.role, phone: form.phone, username: form.username, pin: form.pin });
                toast(value.id ? 'Staff account updated.' : `${form.name} can now sign in.`);
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
        <Field label="Full name" required>
          <input value={form.name || ''} onChange={(event) => set('name')(event.target.value)} />
        </Field>
        <Field label="Username" required>
          <input value={form.username || ''} onChange={(event) => set('username')(event.target.value)} autoCapitalize="none" />
        </Field>
        <Field label="Role" required hint={ROLES[form.role]?.blurb}>
          <select value={form.role} onChange={(event) => set('role')(event.target.value)}>
            {Object.values(ROLES).map((role) => (
              <option key={role.key} value={role.key}>{role.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Phone">
          <input value={form.phone || ''} onChange={(event) => set('phone')(event.target.value)} />
        </Field>
        <Field label={value.id ? 'New PIN (leave empty to keep)' : 'PIN'} required={!value.id} hint="At least 4 digits.">
          <input value={form.pin} onChange={(event) => set('pin')(event.target.value)} inputMode="numeric" maxLength={8} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------ form builder ----------------------------- */

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'phone', label: 'Phone number' },
  { value: 'email', label: 'E-mail' },
  { value: 'select', label: 'Choose from a list' },
];

function FormBuilder() {
  const { toast } = useApp();
  const [fields, setFields] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => setFields((await api.get('/admin/registration-fields')).fields);

  useEffect(() => {
    load();
  }, []);

  const update = (index, patch) => setFields(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const move = (index, direction) => {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      const result = await api.post('/admin/registration-fields', {
        fields: fields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          label_am: field.label_am,
          type: field.type,
          required: field.required,
          options: field.type === 'select' ? (field.options?.length ? field.options : ['Option 1', 'Option 2']) : undefined,
          placeholder: field.placeholder,
          default: field.default,
        })),
      });
      setFields(result.fields);
      toast('Guest form saved — the desk and the QR page use it immediately.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Guest details</div>
          <h1>The questions you ask every guest</h1>
          <p className="page-desc">
            Build the registration form once. The cashier sees it at the desk, and guests fill exactly the same form themselves after scanning
            the QR code at reception or on the room door. Different hotels need different details — this is yours.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setFields([...fields, { key: `field_${fields.length + 1}`, label: 'New question', type: 'text', required: false }])}>
            <Icon name="plus" size={14} /> Add question
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            <Icon name="check" size={15} /> Save the form
          </button>
        </div>
      </div>

      <Card title="Form fields" subtitle="Order here is the order the guest sees">
        {fields.length === 0 ? (
          <Empty title="No questions yet" hint="Add your first question — full name and phone are a good start." icon="clipboard" />
        ) : (
          <div className="stack">
            {fields.map((field, index) => (
              <div key={field.id || index} className="card card-pad" style={{ background: '#fbfdfc' }}>
                <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <Field label="Question (English)">
                      <input value={field.label} onChange={(event) => update(index, { label: event.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <Field label="Question (Amharic)">
                      <input value={field.label_am || ''} onChange={(event) => update(index, { label_am: event.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: '0 0 170px' }}>
                    <Field label="Type">
                      <select value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: '0 0 120px' }}>
                    <Field label="Required">
                      <select value={field.required ? 'yes' : 'no'} onChange={(event) => update(index, { required: event.target.value === 'yes' })}>
                        <option value="yes">Required</option>
                        <option value="no">Optional</option>
                      </select>
                    </Field>
                  </div>
                  <div className="row tight" style={{ paddingBottom: 6 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => move(index, -1)}><Icon name="chevron-left" size={14} /></button>
                    <button className="btn btn-sm btn-ghost" onClick={() => move(index, 1)}><Icon name="chevron-right" size={14} /></button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={async () => {
                        if (!window.confirm(`Remove “${field.label}”?`)) return;
                        if (field.id) await api.del(`/admin/registration-fields/${field.id}`);
                        setFields(fields.filter((_, i) => i !== index));
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <div className="row" style={{ gap: 12, marginTop: 4 }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <Field label="Helper text (placeholder)">
                      <input value={field.placeholder || ''} onChange={(event) => update(index, { placeholder: event.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <Field label="Short code (used in the database)">
                      <input value={field.key} onChange={(event) => update(index, { key: event.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })} />
                    </Field>
                  </div>
                  {field.type === 'select' ? (
                    <div style={{ flex: '2 1 320px' }}>
                      <Field label="Choices" hint="Comma separated">
                        <input
                          value={(field.options || []).join(', ')}
                          onChange={(event) => update(index, { options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean) })}
                          placeholder="National ID, Passport, Driving licence"
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="banner info" style={{ marginTop: 16 }}>
        <Icon name="qr" size={15} />
        <span>
          The guest QR page is public: guests fill this form themselves and the cashier gets a live notification to approve or decline it —
          no paperwork at the desk.
        </span>
      </div>
    </>
  );
}
