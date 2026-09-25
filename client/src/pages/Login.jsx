import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { Icon, ROLE_ICON } from '../lib/icons.jsx';
import { Field } from '../lib/ui.jsx';
import { ROLES } from '../../../shared/billing.js';

// Role definitions ship with the app, so the first-run sign-in screen never
// depends on the API to render its role choices.
const LOCAL_ROLES = Object.values(ROLES);

export default function Login() {
  const { login, settings, toast } = useApp();
  const roles = LOCAL_ROLES;
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [build, setBuild] = useState('');
  const [serverState, setServerState] = useState('checking');
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.public.get('/health')
      .then((data) => {
        if (!active) return;
        setBuild(data.version || '');
        setServerState('online');
      })
      .catch(() => {
        if (active) setServerState('offline');
      });
    return () => { active = false; };
  }, [connectionAttempt]);

  const retryConnection = () => {
    setServerState('checking');
    setConnectionAttempt((attempt) => attempt + 1);
  };

  const chooseRole = (key) => {
    setRole(key);
    setError('');
    setUsername('');
    setPin('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!role) return setError('Choose the desk you work at first.');
    if (!username || !pin) return setError('Enter your username and PIN.');
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), pin);
      toast(`Welcome back, ${user.name.split(' ')[0]}.`);
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-hero">
        <img src="/hotel-lobby.jpg" alt="" />
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">{String(settings.hotel_name || 'CLOVE HOUSE').toUpperCase()}</div>
            <div className="brand-sub">{settings.property_line || 'Hotel operations'}</div>
          </div>
        </div>
        <div>
          <h1>One system for the whole hotel.</h1>
          <p>
            Rooms, guest bills, room-service orders and the kitchen, barista and juice stations — all connected live.
            Every role signs in to exactly what they need, nothing more.
          </p>
          <div className="row" style={{ gap: 18, marginTop: 22, color: '#cfe4de', fontSize: 12 }}>
            <span className="row tight"><Icon name="wifi" size={14} /> Works on hotel Wi-Fi</span>
            <span className="row tight"><Icon name="qr" size={14} /> Guest QR ordering</span>
            <span className="row tight"><Icon name="receipt" size={14} /> Bills that add up on their own</span>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
          <div className="eyebrow">Staff sign in</div>
          <h1 style={{ fontSize: 28 }}>{role ? 'Enter your PIN' : 'Which desk are you on?'}</h1>
          <p className="page-desc" style={{ marginBottom: 20 }}>
            {role
              ? `You are signing in to the ${roles.find((r) => r.key === role)?.label} workspace.`
              : 'Pick your role, then sign in with your username and PIN.'}
          </p>

          {serverState === 'offline' ? (
            <div className="banner warn" role="status" style={{ marginBottom: 16 }}>
              <Icon name="alert" size={15} />
              <span style={{ flex: 1 }}>
                Role choices are ready, but the sign-in server is not responding. Check the hotel connection, then retry.
              </span>
              <button type="button" className="btn btn-sm" onClick={retryConnection}>Retry</button>
            </div>
          ) : null}

          {!role ? (
            <>
              <div className="role-grid" role="group" aria-label="Choose your staff role">
                {roles.map((item) => (
                  <button type="button" key={item.key} className="role-card" onClick={() => chooseRole(item.key)}>
                    <div className="ic"><Icon name={ROLE_ICON[item.key] || 'user'} size={17} /></div>
                    <strong>{item.label}</strong>
                    <div className="am">{item.am}</div>
                    <div className="blurb">{item.blurb}</div>
                  </button>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
                New staff accounts are created by an Owner / Admin under Staff &amp; access.
              </p>
            </>
          ) : (
            <form className="login-form" onSubmit={submit}>
              <div className="row" style={{ marginBottom: 16 }}>
                <div className="avatar"><Icon name={ROLE_ICON[role] || 'user'} size={16} /></div>
                <div style={{ flex: 1 }}>
                  <strong>{roles.find((r) => r.key === role)?.label}</strong>
                  <div className="tiny muted">{roles.find((r) => r.key === role)?.blurb}</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setRole(null)}>
                  <Icon name="chevron-left" size={13} /> Change
                </button>
              </div>

              <div className="form-grid">
                <Field label="Username" required>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="e.g. cashier"
                    autoCapitalize="none"
                    autoFocus
                  />
                </Field>
                <Field label="PIN" required hint="Ask the manager if you forgot it.">
                  <input
                    type="password"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    placeholder="••••"
                    inputMode="numeric"
                    maxLength={8}
                  />
                </Field>
              </div>

              {error ? (
                <div className="banner bad" style={{ marginTop: 14 }}>
                  <Icon name="alert" size={15} />
                  <span>{error}</span>
                </div>
              ) : null}

              <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy} type="submit">
                {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow-right" size={16} />
              </button>

              <div className="banner info" style={{ marginTop: 16 }}>
                <Icon name="lock" size={15} />
                <div>
                  <strong>Demo PIN for every account is 1234.</strong>
                  <div className="tiny" style={{ marginTop: 4 }}>
                    Try <code>cashier</code>, <code>kitchen</code>, <code>barista</code>, <code>juice</code>, <code>waiter</code> or <code>admin</code> —
                    open them in two tabs to see the live hand-off.
                  </div>
                </div>
              </div>
            </form>
          )}
          {build ? (
            <div className="tiny muted" style={{ marginTop: 18, textAlign: 'center' }}>
              build {build}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
