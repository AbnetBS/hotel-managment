import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { getToken } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { dateTimeOf, dayLong } from '../lib/format.js';
import { Card, Field, Empty, Stat } from '../lib/ui.jsx';

export default function AdminSystem({ mode }) {
  if (mode === 'qrcodes') return <QrCodes />;
  if (mode === 'audit') return <AuditLog />;
  return <SettingsPanel />;
}

/* -------------------------------- QR codes ------------------------------- */

function QrCodes() {
  const { rooms, toast } = useApp();
  const [base, setBase] = useState(window.location.origin);
  const [kind, setKind] = useState('q');

  const url = (room, target) => `${base.replace(/\/$/, '')}/${target}/${room.qr_token}`;
  const img = (room, target) => `/api/qr/${room.id}.png?target=${target}&base=${encodeURIComponent(base)}&token=${encodeURIComponent(getToken() || '')}`;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="eyebrow">Print &amp; stick</div>
          <h1>Room QR codes</h1>
          <p className="page-desc">
            Two codes per room. The <strong>menu code</strong> goes in the room — the guest scans it and orders food to the room. The{' '}
            <strong>registration code</strong> goes at reception or on the door: the guest fills their details, and the desk approves them.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={14} /> Print this sheet
          </button>
        </div>
      </div>

      <Card title="Which code is on the sheet?" subtitle="Print one kind at a time, or both" className="no-print">
        <div className="row" style={{ gap: 12 }}>
          <div className="seg">
            <button className={kind === 'q' ? 'on' : ''} onClick={() => setKind('q')}>Order food (in the room)</button>
            <button className={kind === 'r' ? 'on' : ''} onClick={() => setKind('r')}>Register guest (reception)</button>
            <button className={kind === 'both' ? 'on' : ''} onClick={() => setKind('both')}>Both</button>
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <Field label="Address guests will open" hint="Use the address your hotel Wi-Fi can reach — a local IP or your real domain.">
              <input value={base} onChange={(event) => setBase(event.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      <div style={{ height: 18 }} className="no-print" />

      <div className="qr-sheet">
        {rooms.map((room) => (
          <div className="qr-card" key={room.id}>
            <div className="num">Room {room.number}</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>{room.type?.name}</div>
            <div className="qr-pair" style={{ flexDirection: kind === 'both' ? 'row' : 'column' }}>
              {kind !== 'r' ? (
                <div>
                  <img src={img(room, 'q')} alt={`Menu QR for room ${room.number}`} />
                  <div className="cap">Scan to order food &amp; drinks</div>
                </div>
              ) : null}
              {kind !== 'q' ? (
                <div>
                  <img src={img(room, 'r')} alt={`Registration QR for room ${room.number}`} />
                  <div className="cap">Scan to register &amp; check in</div>
                </div>
              ) : null}
            </div>
            <div className="tiny muted" style={{ marginTop: 10, wordBreak: 'break-all' }}>
              {kind === 'r' ? url(room, 'r') : url(room, 'q')}
            </div>
          </div>
        ))}
      </div>

      <div className="banner warn no-print" style={{ marginTop: 18 }}>
        <Icon name="alert" size={15} />
        <span>
          If a guest shares the code or a room changes use, regenerate the code from <strong>Rooms &amp; photos → Room list</strong> and print the
          sheet again.
        </span>
      </div>
    </>
  );
}

/* -------------------------------- settings ------------------------------- */

function SettingsPanel() {
  const { settings, toast, loadAll } = useApp();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(settings), [settings]);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Hotel setup</div>
          <h1>Hotel settings</h1>
          <p className="page-desc">Receipts, taxes, checkout time and the small rules that keep the desk consistent.</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.patch('/admin/settings', form);
              toast('Settings saved.');
              await loadAll();
            } catch (error) {
              toast(error.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="check" size={15} /> Save settings
        </button>
      </div>

      <div className="grid grid-main">
        <Card title="The hotel" subtitle="Shown on receipts and on the guest pages">
          <div className="form-grid">
            <Field label="Hotel name">
              <input value={form.hotel_name || ''} onChange={(event) => set('hotel_name')(event.target.value)} />
            </Field>
            <Field label="Property line">
              <input value={form.property_line || ''} onChange={(event) => set('property_line')(event.target.value)} />
            </Field>
            <Field label="Phone">
              <input value={form.phone || ''} onChange={(event) => set('phone')(event.target.value)} />
            </Field>
            <Field label="Currency">
              <input value={form.currency || ''} onChange={(event) => set('currency')(event.target.value)} />
            </Field>
            <Field label="Address" full>
              <textarea value={form.address || ''} onChange={(event) => set('address')(event.target.value)} />
            </Field>
            <Field label="Receipt footer" full>
              <input value={form.receipt_footer || ''} onChange={(event) => set('receipt_footer')(event.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Money &amp; timing" subtitle="How the bills and the day work">
          <div className="form-grid">
            <Field label="VAT %">
              <input type="number" value={form.vat_percent ?? ''} onChange={(event) => set('vat_percent')(event.target.value)} />
            </Field>
            <Field label="Service charge %">
              <input type="number" value={form.service_charge_percent ?? ''} onChange={(event) => set('service_charge_percent')(event.target.value)} />
            </Field>
            <Field label="Checkout time (hour)">
              <input type="number" value={form.checkout_hour ?? 12} onChange={(event) => set('checkout_hour')(event.target.value)} />
            </Field>
            <Field label="Grace hours" hint="Extra time before another night is charged.">
              <input type="number" value={form.grace_hours ?? 1} onChange={(event) => set('grace_hours')(event.target.value)} />
            </Field>
            <Field label="Day-use default (hours)">
              <input type="number" value={form.dayuse_default_hours ?? 3} onChange={(event) => set('dayuse_default_hours')(event.target.value)} />
            </Field>
            <Field label="Wi-Fi name">
              <input value={form.wifi_name || ''} onChange={(event) => set('wifi_name')(event.target.value)} />
            </Field>
            <Field label="Wi-Fi password">
              <input value={form.wifi_password || ''} onChange={(event) => set('wifi_password')(event.target.value)} />
            </Field>
            <Field label="Ring the desk on new QR orders?">
              <select value={form.alert_sound ? 'yes' : 'no'} onChange={(event) => set('alert_sound')(event.target.value === 'yes' ? 1 : 0)}>
                <option value="yes">Yes — sound + full screen alert</option>
                <option value="no">No — just the queue</option>
              </select>
            </Field>
            <Field label="Ask the desk to call the guest before sending?">
              <select value={form.require_call_confirmation ? 'yes' : 'no'} onChange={(event) => set('require_call_confirmation')(event.target.value === 'yes' ? 1 : 0)}>
                <option value="yes">Yes — confirm every order by phone</option>
                <option value="no">No — accept and send</option>
              </select>
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
}

/* --------------------------------- audit --------------------------------- */

function AuditLog() {
  const [log, setLog] = useState([]);
  useEffect(() => {
    api.get('/admin/audit?limit=200').then((data) => setLog(data.log)).catch(() => setLog([]));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Nothing disappears</div>
          <h1>Audit log</h1>
          <p className="page-desc">Every check-in, payment, price change and staff change is written down with who did it and when.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Entries" value={log.length} icon="list" foot="Most recent 200" />
        <Stat label="Today" value={log.filter((entry) => new Date(entry.at).toDateString() === new Date().toDateString()).length} icon="clock" foot={dayLong(Date.now())} />
        <Stat label="Cash movements" value={log.filter((entry) => ['payment', 'check-out'].includes(entry.action)).length} icon="banknote" foot="Payments & releases" />
      </div>

      <Card noBody>
        {log.length === 0 ? (
          <Empty title="No entries yet" hint="Actions appear here as staff use the system." icon="list" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr key={entry.id}>
                  <td className="small muted">{dateTimeOf(entry.at)}</td>
                  <td>
                    <strong className="small">{entry.actor_name}</strong>
                    <div className="tiny muted">{entry.role}</div>
                  </td>
                  <td><span className="pill gray">{entry.action}</span></td>
                  <td className="small">{entry.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
