import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Icon } from '../../lib/icons.jsx';

/**
 * "Special request" — one tap on what the guest needs, plus a free note.
 * It goes straight to the department that owns it (housekeeping, maintenance,
 * the waiter or the desk), so nobody has to walk down and queue at reception.
 */
export default function GuestRequest({ token, room, kinds, onBack, onDone }) {
  const [chosen, setChosen] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);

  const list = (kinds || []).filter((kind) => kind.key !== 'other');

  const send = async () => {
    if (!chosen) return setError('Please choose what you need.');
    if (chosen.key === 'other' && !note.trim()) return setError('Please write what you need.');
    setBusy(true);
    setError('');
    try {
      const result = await api.public.post(`/public/request/${token}`, { kind: chosen.key, note: note.trim() });
      setSent({ ...result, kind: chosen });
      setNote('');
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ margin: '6px auto 14px', width: 54, height: 54, background: 'var(--green-soft)', color: '#1f7a52' }}>
          <Icon name="check" size={26} />
        </div>
        <h2 style={{ fontSize: 24 }}>We are on it</h2>
        <p className="page-desc" style={{ margin: '12px auto 0' }}>
          <strong>{sent.kind.label}{sent.kind.am ? ` · ${sent.kind.am}` : ''}</strong> sent for Room {room?.number}.
          {sent.kind.department === 'housekeeping' ? ' Housekeeping has been told.' : null}
          {sent.kind.department === 'maintenance' ? ' Maintenance has a ticket for it.' : null}
          {sent.kind.department === 'waiter' ? ' The service team has been told.' : null}
          {sent.kind.department === 'desk' ? ' The reception desk has been told.' : null}
          {sent.kind.priced ? ' It is charged to your room bill when it is done.' : ''}
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={() => setSent(null)}>Ask for something else</button>
          <button className="btn btn-primary" onClick={onBack}>Back to start</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        <Icon name="arrow-left" size={15} /> Back
      </button>

      <div className="card card-pad">
        <h2>Special request · ልዩ ጥያቄ</h2>
        <p className="small muted" style={{ marginTop: 6 }}>
          Tap what you need — Room {room?.number}. Someone is told immediately; you do not have to call the desk.
        </p>

        <div className="request-grid">
          {list.map((kind) => (
            <button
              key={kind.key}
              type="button"
              className={`request-tile ${chosen?.key === kind.key ? 'on' : ''}`}
              onClick={() => setChosen(kind)}
            >
              <Icon name={kind.icon || 'bell'} size={20} />
              <strong>{kind.label}</strong>
              <span>{kind.am}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`request-tile wide ${chosen?.key === 'other' ? 'on' : ''}`}
          onClick={() => setChosen({ key: 'other', label: 'Something else', am: 'ሌላ', priced: true, department: 'desk' })}
          style={{ marginTop: 10 }}
        >
          <Icon name="message" size={18} />
          <strong>Something else · ሌላ</strong>
        </button>
      </div>

      <div className="card card-pad">
        <label className="field">
          <span>Tell us more (optional) · ተጨማሪ</span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="For example: Please bring 2 towels"
            maxLength={400}
          />
        </label>

        {chosen?.priced ? (
          <p className="small muted" style={{ marginTop: 8 }}>
            <Icon name="banknote" size={13} /> This one is charged to your room bill when it is delivered.
          </p>
        ) : null}

        {error ? <div className="banner warn" style={{ marginTop: 10 }}><Icon name="alert" size={14} /> <span>{error}</span></div> : null}

        <button className="btn btn-primary btn-lg" style={{ marginTop: 12, width: '100%' }} disabled={busy || !chosen} onClick={send}>
          <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  );
}
