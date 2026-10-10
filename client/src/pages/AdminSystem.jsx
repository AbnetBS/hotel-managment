import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { getToken } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { dateTimeOf, dayLong, money } from '../lib/format.js';
import { Card, Field, Empty, Stat } from '../lib/ui.jsx';
import { ReceiptModal } from '../components/Receipt.jsx';

export default function AdminSystem({ mode }) {
  if (mode === 'qrcodes') return <QrCodes />;
  if (mode === 'tables') return <TablesPanel />;
  if (mode === 'receipt') return <ReceiptPanel />;
  if (mode === 'receipts') return <PrintedReceipts />;
  if (mode === 'audit') return <AuditLog />;
  return <SettingsPanel />;
}

/* --------------------------- printed receipts ---------------------------- */
/** The soft copy of every slip the desk printed — the owner's paper trail. */

function PrintedReceipts() {
  const { toast } = useApp();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = () => api.get(`/receipts?limit=300${search ? `&search=${encodeURIComponent(search)}` : ''}`)
    .then((data) => setRows(data.receipts || []))
    .catch((error) => toast(error.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = rows.filter((r) => String(r.printed_at).slice(0, 10) === new Date().toISOString().slice(0, 10));
  const todayTotal = today.reduce((sum, r) => sum + (Number(r.total_etb) || 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Paper trail</div>
          <h1>Printed receipts</h1>
        </div>
        <div className="row">
          <div className="search">
            <Icon name="search" size={14} />
            <input
              value={search}
              placeholder="Room, guest or invoice…"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && load()}
            />
          </div>
          <button className="btn" onClick={load}><Icon name="rotate-ccw" size={14} /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Printed today" value={today.length} icon="print" foot="Slips handed to guests" />
        <Stat label="Total today" value={money(todayTotal)} icon="banknote" foot="Room + food + services" />
        <Stat label="On file" value={rows.length} icon="list" foot="Most recent 300" />
      </div>

      <Card noBody>
        {rows.length === 0 ? (
          <Empty title="No receipts printed yet" hint="Every print the cashier makes lands here." icon="print" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Printed</th>
                <th>Invoice</th>
                <th>Room / table</th>
                <th>Guest</th>
                <th>Room (guest money)</th>
                <th>Food &amp; services</th>
                <th>Total (birr)</th>
                <th>Printed by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="small muted">{dateTimeOf(row.printed_at)}</td>
                  <td className="small">{row.invoice_no || '—'}<div className="tiny muted">FS {row.fs || '—'}</div></td>
                  <td><strong className="small">{row.room_label}</strong><div className="tiny muted">{row.kind === 'order' ? 'Order' : 'Stay bill'}</div></td>
                  <td className="small">{row.guest_name || '—'}</td>
                  <td className="small">{row.currency !== 'ETB' ? `${Number(row.room_total_foreign).toFixed(2)} ${row.currency}` : money(row.room_total_etb)}</td>
                  <td className="small">{money(row.extras_total_etb)}</td>
                  <td className="small"><strong>{money(row.total_etb)}</strong></td>
                  <td className="small muted">{row.printed_by || '—'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setOpen(row)}>
                      <Icon name="eye" size={13} /> Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open ? (
        <ReceiptModal
          data={{ ...(open.rows || {}), fs: open.fs }}
          archive={false}
          invoiceNo={open.invoice_no}
          title={`Receipt · ${open.invoice_no || open.room_label}`}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

/* -------------------------------- tables --------------------------------- */
/** Tables get unique QR codes just like rooms — guests scan and order from the table. */

function TablesPanel() {
  const { toast } = useApp();
  const [tables, setTables] = useState([]);
  const [name, setName] = useState('');
  const [seats, setSeats] = useState(4);
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState(window.location.origin);

  const load = () => api.get('/tables').then((data) => setTables(data.tables || [])).catch(() => setTables([]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return toast('Give the table a name.', 'error');
    setBusy(true);
    try {
      await api.post('/admin/tables', { name: name.trim(), seats: Number(seats) || 0 });
      setName('');
      toast('Table added.');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id, body) => {
    try {
      await api.patch(`/admin/tables/${id}`, body);
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const regen = async (id) => {
    try {
      await api.post(`/admin/tables/${id}/qr`);
      toast('New QR code made.');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const remove = async (id, label) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    try {
      await api.del(`/admin/tables/${id}`);
      toast('Table removed.');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="eyebrow">Tables</div>
          <h1>Tables &amp; their QR codes</h1>
        </div>
        <button className="btn" onClick={() => window.print()}>
          <Icon name="print" size={14} /> Print QR sheet
        </button>
      </div>

      <Card title="Add a table" className="no-print">
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Field label="Name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Table 7" /></Field>
          </div>
          <div style={{ width: 120 }}>
            <Field label="Seats"><input type="number" value={seats} onChange={(event) => setSeats(event.target.value)} /></Field>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={add}><Icon name="plus" size={15} /> Add table</button>
        </div>
      </Card>

      <div style={{ height: 18 }} className="no-print" />

      <Card title="All tables" noBody className="no-print">
        {tables.length === 0 ? (
          <Empty title="No tables yet" icon="qr" />
        ) : (
          <table>
            <thead>
              <tr><th>Table</th><th>Seats</th><th>QR link</th><th></th></tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}>
                  <td>
                    <input
                      style={{ maxWidth: 160 }}
                      defaultValue={table.name}
                      onBlur={(event) => event.target.value !== table.name && patch(table.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ maxWidth: 80 }}
                      defaultValue={table.seats}
                      onBlur={(event) => Number(event.target.value) !== table.seats && patch(table.id, { seats: Number(event.target.value) })}
                    />
                  </td>
                  <td className="tiny muted" style={{ wordBreak: 'break-all', maxWidth: 260 }}>/q/{table.qr_token}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <a className="btn btn-sm" href={`/api/qr/${table.id}.png?token=${encodeURIComponent(getToken() || '')}`} target="_blank" rel="noreferrer">
                        <Icon name="qr" size={13} /> QR
                      </a>
                      <button className="btn btn-sm" onClick={() => regen(table.id)}><Icon name="rotate-ccw" size={13} /> New code</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(table.id, table.name)}><Icon name="trash" size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="qr-sheet">
        {tables.map((table) => (
          <div className="qr-card" key={table.id}>
            <div className="num">{table.name}</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>{table.seats ? `${table.seats} seats` : ''}</div>
            <img src={`/api/qr/${table.id}.png?token=${encodeURIComponent(getToken() || '')}`} alt={`Menu QR for ${table.name}`} />
            <div className="cap">Scan to see the menu &amp; order</div>
            <div className="tiny muted" style={{ marginTop: 10, wordBreak: 'break-all' }}>
              {base.replace(/\/$/, '')}/q/{table.qr_token}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* --------------------------- receipt template ---------------------------- */
/** The head and foot of every printed receipt — TIN, name, address, FS number. */

function ReceiptPanel() {
  const { settings, toast, loadAll } = useApp();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(settings), [settings]);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Printing</div>
          <h1>Receipt template</h1>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.patch('/admin/settings', form);
              toast('Receipt template saved.');
              await loadAll();
            } catch (error) {
              toast(error.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="check" size={15} /> Save template
        </button>
      </div>

      <div className="grid grid-main">
        <Card title="Receipt head">
          <div className="form-grid">
            <Field label="TIN">
              <input value={form.receipt_tin || ''} onChange={(event) => set('receipt_tin')(event.target.value)} placeholder="0052/2119" />
            </Field>
            <Field label="FS No (next)">
              <input value={form.receipt_fs || ''} onChange={(event) => set('receipt_fs')(event.target.value)} placeholder="00162882" />
            </Field>
            <Field label="Business name on the receipt" full>
              <input value={form.receipt_name || ''} onChange={(event) => set('receipt_name')(event.target.value)} placeholder="MY HOTEL PLC" />
            </Field>
            <Field label="Address lines" full>
              <textarea value={form.receipt_address || ''} onChange={(event) => set('receipt_address')(event.target.value)} placeholder="Bole Road, Addis Ababa" />
            </Field>
            <Field label="Telephone">
              <input value={form.receipt_phone || ''} onChange={(event) => set('receipt_phone')(event.target.value)} placeholder="TEL-011 000 0000" />
            </Field>
            <Field label="Invoice title">
              <input value={form.receipt_title || ''} onChange={(event) => set('receipt_title')(event.target.value)} placeholder="CASH INVOICE" />
            </Field>
          </div>
        </Card>

        <Card title="Receipt foot">
          <div className="form-grid">
            <Field label="Footer line 1" full>
              <input value={form.receipt_footer || ''} onChange={(event) => set('receipt_footer')(event.target.value)} />
            </Field>
            <Field label="Footer line 2" full>
              <input value={form.receipt_footer2 || ''} onChange={(event) => set('receipt_footer2')(event.target.value)} />
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
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
        </div>
        <div className="row">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={14} /> Print this sheet
          </button>
        </div>
      </div>

      <Card title="Which code is on the sheet?" className="no-print">
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
        <Card title="The hotel">
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
            <Field label="Receipt TIN">
              <input value={form.receipt_tin || ''} onChange={(event) => set('receipt_tin')(event.target.value)} />
            </Field>
            <Field label="Receipt footer">
              <input value={form.receipt_footer || ''} onChange={(event) => set('receipt_footer')(event.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Website">
          <div className="form-grid">
            <Field label="Hero title" full>
              <input value={form.hero_title || ''} onChange={(event) => set('hero_title')(event.target.value)} />
            </Field>
            <Field label="Hero tagline" full>
              <input value={form.hero_tagline || ''} onChange={(event) => set('hero_tagline')(event.target.value)} />
            </Field>
            <Field label="Hero image" full>
              <input value={form.hero_image || ''} onChange={(event) => set('hero_image')(event.target.value)} placeholder="/hotel-lobby.jpg" />
            </Field>
          </div>
        </Card>

        <Card title="Money &amp; timing">
          <div className="form-grid">
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
  const { toast } = useApp();
  const [log, setLog] = useState([]);
  const [pauses, setPauses] = useState([]);

  const load = () => {
    api.get('/admin/audit?limit=200').then((data) => setLog(data.log)).catch(() => setLog([]));
    api.get('/admin/login-pauses').then((data) => setPauses(data.pauses)).catch(() => setPauses([]));
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => api.get('/admin/login-pauses').then((data) => setPauses(data.pauses)).catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, []);

  const unblock = async (username) => {
    try {
      const result = await api.post('/admin/login-pauses/clear', username ? { username } : {});
      toast(result.cleared ? `${result.cleared} sign-in pause(s) cleared.` : 'Nothing was paused.', 'info');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Nothing disappears</div>
          <h1>Audit log</h1>
        </div>
      </div>

      {pauses.length ? (
        <div className="card" style={{ marginBottom: 18, padding: 14, borderColor: '#f0cdc4' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{pauses.length} sign-in{s.pauses === 1 ? '' : 's'} paused after wrong PINs</strong>
              <div className="muted" style={{ fontSize: 12 }}>
                {pauses.map((pause) => `${pause.username} (${pause.secondsLeft}s)`).join(' · ')} — clear it when the person is standing in front of you.
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => unblock()}>
              <Icon name="key-2" size={13} /> Clear all
            </button>
          </div>
        </div>
      ) : null}

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
