import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { Card, Field, Pill, Stat } from '../lib/ui.jsx';

/**
 * Currency & branches.
 *
 * A guest who pays in dollars should be quoted dollars, and the desk should not
 * be guessing the rate from the blackboard. The official rate is fetched when the
 * hotel has internet; when it does not, the rate can be typed in by hand and the
 * cached one keeps working.
 */
export default function Money({ mode = 'currency' }) {
  return mode === 'branches' ? <Branches /> : <Currency />;
}

function Currency() {
  const { toast } = useApp();
  const [card, setCard] = useState(null);
  const [rates, setRates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/admin/fx');
      setCard(data);
      setRates(data.rates || {});
    } catch (error) {
      toast(error.message, 'error');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!card) {
    return <Card title="Currency" noBody><div style={{ padding: 18 }} className="muted small">Reading the rate card…</div></Card>;
  }

  const editable = Object.keys(rates).filter((code) => code !== 'ETB');
  const today = card.today || [];
  const foreignToday = today.filter((row) => row.currency !== 'ETB');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Money · ገንዘብ</div>
          <h1>Currency &amp; rates</h1>
          <p className="page-desc">
            The desk freezes the guest's rate at check-in, so the bill never moves. Pull the official rates from the
            National Bank feed when there is internet — otherwise type today's rate and everything keeps working.
          </p>
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                const fresh = await api.post('/fx/refresh', {});
                setCard((current) => ({ ...current, ...fresh }));
                setRates(fresh.rates || {});
                toast(
                  fresh.ok
                    ? `Official rates loaded from ${fresh.source_label}.`
                    : `Could not reach the bank feed — ${fresh.error}`,
                  fresh.ok ? 'success' : 'error',
                );
              } catch (error) {
                toast(error.message, 'error');
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <Icon name="rotate-ccw" size={15} /> {refreshing ? 'Calling the bank…' : 'Get official rates'}
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat
          label="Rate source"
          value={card.source === 'nbe' ? 'Official' : card.source === 'manual' ? 'Typed in' : card.source === 'cache' ? 'Cached' : 'Starting rates'}
          icon="exchange"
          alert={card.source === 'fallback'}
          foot={card.source_label}
        />
        <Stat label="Last updated" value={card.updated_at ? new Date(card.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never'} icon="clock" foot="Checked every 6 hours" />
        <Stat label="Foreign money today" value={`${foreignToday.length} currenc${foreignToday.length === 1 ? 'y' : 'ies'}`} icon="banknote" foot={foreignToday.map((row) => `${row.currency} ${Math.round(row.foreign)}`).join(' · ') || 'no foreign payments yet'} />
      </div>

      <Card
        title="Rate card"
        subtitle="Birr per one unit — used for the guest bill and for every dollar payment taken at the desk"
        noBody
      >
        <table>
          <thead>
            <tr><th>Currency</th><th>Rate in birr</th><th>Today's payments</th><th /></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>ETB</strong><div className="tiny muted">Ethiopian birr</div></td>
              <td><strong>1.00</strong></td>
              <td className="small muted">—</td>
              <td />
            </tr>
            {editable.map((code) => {
              const row = today.find((entry) => entry.currency === code);
              return (
                <tr key={code}>
                  <td><strong>{code}</strong></td>
                  <td>
                    <input
                      type="number"
                      step="0.0001"
                      value={rates[code]}
                      style={{ width: 120 }}
                      onChange={(event) => setRates((current) => ({ ...current, [code]: event.target.value }))}
                    />
                  </td>
                  <td className="small muted">
                    {row ? `${Math.round(row.foreign * 100) / 100} ${code} · ${money(row.etb)}` : '—'}
                  </td>
                  <td className="small muted">
                    {row ? `${row.count} payment(s)` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
        <p className="small muted" style={{ maxWidth: 520 }}>
          Typing a rate here marks it as set by the hotel — the automatic pull will not overwrite it until you press the button above.
        </p>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const fresh = await api.post('/admin/fx/rates', { rates });
              setCard((current) => ({ ...current, ...fresh }));
              toast('Rate card saved. New check-ins use these rates.');
            } catch (error) {
              toast(error.message, 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Icon name="check" size={15} /> Save the rate card
        </button>
      </div>

      {foreignToday.length ? (
        <Card title="Foreign currency taken today" subtitle="What the drawer should hold, currency by currency" noBody>
          <table>
            <thead><tr><th>Currency</th><th>Received</th><th>In birr</th><th>Rate used</th><th>Payments</th></tr></thead>
            <tbody>
              {foreignToday.map((row) => (
                <tr key={row.currency}>
                  <td><strong>{row.currency}</strong></td>
                  <td><strong>{Math.round(row.foreign * 100) / 100} {row.currency}</strong></td>
                  <td>{money(row.etb)}</td>
                  <td className="small muted">{row.rate}</td>
                  <td className="small muted">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}

function Branches() {
  const { toast, user } = useApp();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '' });

  const load = useCallback(async () => {
    try {
      setBranches((await api.get('/admin/branches')).branches);
    } catch (error) {
      toast(error.message, 'error');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Group · ቅርንጫፎች</div>
          <h1>Branches</h1>
          <p className="page-desc">
            Rooms, stays, orders and money already carry the branch they belong to. Add the second property here when the
            group grows — the reports can then be read per branch instead of per paper file.
          </p>
        </div>
      </div>

      <Card title="Properties" subtitle="The first branch is the one this system is running on now" noBody>
        <table>
          <thead><tr><th>Name</th><th>Code</th><th>Address</th><th>Phone</th><th>Rooms</th><th>Status</th></tr></thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td><strong>{branch.name}</strong></td>
                <td>{branch.code || '—'}</td>
                <td className="small muted">{branch.address || '—'}</td>
                <td className="small muted">{branch.phone || '—'}</td>
                <td className="small muted">{branch.rooms ?? '—'}</td>
                <td><Pill status={branch.active ? 'available' : 'out_of_order'}>{branch.active ? 'open' : 'closed'}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {user.role === 'admin' ? (
        <Card title="Add a branch" subtitle="Rooms and staff can then be attached to it">
          <div className="form-grid">
            <Field label="Name" required><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Clove House · Hawassa" /></Field>
            <Field label="Short code"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="HW" /></Field>
            <Field label="Address"><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            disabled={!form.name}
            onClick={async () => {
              try {
                await api.post('/admin/branches', form);
                setForm({ name: '', code: '', address: '', phone: '' });
                toast('Branch added.');
                load();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="plus" size={15} /> Add branch
          </button>
        </Card>
      ) : null}
    </>
  );
}
