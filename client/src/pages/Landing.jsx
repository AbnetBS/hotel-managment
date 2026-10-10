import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { Icon, ROLE_ICON } from '../lib/icons.jsx';
import { ROLES } from '../../../shared/billing.js';

const LOCAL_ROLES = Object.values(ROLES);

/**
 * The public home page: hotel photo, hotel words, and one round button in the
 * top corner that opens the staff roles. Nothing else competes for attention.
 */
export default function Landing() {
  const { login, toast } = useApp();
  const [site, setSite] = useState(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.public.get('/hotel').then((data) => setSite(data.hotel)).catch(() => setSite({}));
  }, []);

  const hotelName = String(site?.name || 'CLOVE HOUSE').toUpperCase();
  const heroImage = site?.hero_image || '/hotel-lobby.jpg';
  const heroTitle = site?.hero_title || '';
  const heroTagline = site?.hero_tagline || '';

  const openPanel = () => {
    setOpen(true);
    setRole(null);
    setError('');
  };

  const pickRole = (key) => {
    setRole(key);
    setUsername('');
    setPin('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!username || !pin) return setError('Enter your username and PIN.');
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), pin);
      toast(`Welcome back, ${user.name.split(' ')[0]}.`);
    } catch (err) {
      setError(err.status === 401 || err.status === 400 ? err.message : 'Cannot reach the sign-in server.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-bg" style={{ backgroundImage: `url(${heroImage})` }} />
      <div className="landing-shade" />

      <header className="landing-top">
        <div className="landing-brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">{hotelName}</div>
            {site?.line ? <div className="brand-sub">{site.line}</div> : null}
          </div>
        </div>
        <button className="landing-fab" onClick={openPanel} aria-label="Staff sign in" title="Staff sign in">
          <Icon name="user" size={22} />
        </button>
      </header>

      <main className="landing-hero">
        <h1>{heroTitle}</h1>
        {heroTagline ? <p>{heroTagline}</p> : null}
      </main>

      <footer className="landing-foot">
        <span>{site?.line || ''}</span>
        {site?.phone ? <span>·</span> : null}
        {site?.phone ? <span>{site.phone}</span> : null}
      </footer>

      {open ? (
        <div className="landing-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside className="landing-panel" role="dialog" aria-modal="true">
            <div className="landing-panel-head">
              <strong>{role ? LOCAL_ROLES.find((r) => r.key === role)?.label : 'Staff'}</strong>
              <button
                className="close-x"
                aria-label="Close"
                onClick={() => (role ? setRole(null) : setOpen(false))}
              >
                <Icon name={role ? 'chevron-left' : 'x'} size={16} />
              </button>
            </div>

            {!role ? (
              <div className="role-list">
                {LOCAL_ROLES.map((item) => (
                  <button key={item.key} className="role-row" onClick={() => pickRole(item.key)}>
                    <span className="role-ic"><Icon name={ROLE_ICON[item.key] || 'user'} size={17} /></span>
                    <strong>{item.label}</strong>
                    <Icon name="chevron-right" size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <form className="signin-form" onSubmit={submit}>
                <label>
                  Username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoCapitalize="none"
                    autoFocus
                  />
                </label>
                <label>
                  PIN
                  <input
                    type="password"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>

                {error ? <div className="banner bad">{error}</div> : null}

                <button className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
                  {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow-right" size={16} />
                </button>
              </form>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
