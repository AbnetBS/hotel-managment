import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './lib/store.jsx';
import { Toasts } from './lib/ui.jsx';
import { Icon, ROLE_ICON } from './lib/icons.jsx';
import { canSee, ROLES } from '../../shared/billing.js';
import { dayShort } from './lib/format.js';

import Login from './pages/Login.jsx';
// Guest pages stay in the first download — a guest standing at the door should
// never wait for a second round-trip over hotel Wi-Fi.
import GuestMenu from './pages/guest/GuestMenu.jsx';
import GuestRegister from './pages/guest/GuestRegister.jsx';

// Staff screens load on first visit (each one becomes its own small chunk, so
// the cashier never downloads the admin tools and the first screen paints fast).
const Rooms = lazy(() => import('./pages/Rooms.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Station = lazy(() => import('./pages/Station.jsx'));
const Deliveries = lazy(() => import('./pages/Deliveries.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Front = lazy(() => import('./pages/Front.jsx'));
const AdminProperty = lazy(() => import('./pages/AdminProperty.jsx'));
const AdminMenu = lazy(() => import('./pages/AdminMenu.jsx'));
const AdminTeam = lazy(() => import('./pages/AdminTeam.jsx'));
const AdminSystem = lazy(() => import('./pages/AdminSystem.jsx'));
const NewOrderAlert = lazy(() => import('./components/NewOrderAlert.jsx'));

export const NAV = {
  overview: { label: 'Overview', icon: 'grid' },
  rooms: { label: 'Room board', icon: 'door' },
  roomtypes: { label: 'Rooms & photos', icon: 'image' },
  menu: { label: 'Menu & stations', icon: 'utensils' },
  qrcodes: { label: 'QR codes', icon: 'qr' },
  orders: { label: 'Orders desk', icon: 'receipt' },
  reservations: { label: 'Reservations', icon: 'calendar' },
  stays: { label: 'In-house guests', icon: 'users' },
  folios: { label: 'Guest bills', icon: 'banknote' },
  reports: { label: 'Reports', icon: 'chart' },
  staff: { label: 'Staff & access', icon: 'shield' },
  formbuilder: { label: 'Guest form', icon: 'clipboard' },
  housekeeping: { label: 'Housekeeping', icon: 'sparkles' },
  maintenance: { label: 'Maintenance', icon: 'wrench' },
  settings: { label: 'Hotel settings', icon: 'sliders' },
  audit: { label: 'Audit log', icon: 'list' },
  station: { label: 'My station', icon: 'chef-hat' },
  deliveries: { label: 'Deliveries', icon: 'send' },
};

const NAV_GROUPS = [
  { key: 'overview', items: ['overview', 'reports'] },
  { key: 'front', label: 'Front desk', items: ['rooms', 'orders', 'reservations', 'stays', 'folios'] },
  { key: 'service', label: 'Service', items: ['station', 'deliveries', 'housekeeping', 'maintenance'] },
  { key: 'setup', label: 'Hotel setup', items: ['roomtypes', 'menu', 'qrcodes', 'formbuilder', 'staff', 'settings', 'audit'] },
];

/** The current view + a setter, kept in step with the URL fragment. */
function useView() {
  const [hash, setHash] = useState(window.location.hash.replace('#/', '') || '');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace('#/', ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [hash, setHash];
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

function ScreenLoading() {
  return (
    <div className="center-load">
      <span className="spinner" />
      <span className="muted small">Opening…</span>
    </div>
  );
}

function Screen({ view, onNavigate }) {
  switch (view) {
    case 'overview': return <Insights mode="overview" onNavigate={onNavigate} />;
    case 'reports': return <Insights mode="reports" />;
    case 'rooms': return <Rooms onNavigate={onNavigate} />;
    case 'orders': return <Orders />;
    case 'station': return <Station />;
    case 'deliveries': return <Deliveries />;
    case 'housekeeping': return <Tasks mode="housekeeping" />;
    case 'maintenance': return <Tasks mode="maintenance" />;
    case 'reservations': return <Front mode="reservations" />;
    case 'stays': return <Front mode="stays" />;
    case 'folios': return <Front mode="folios" />;
    case 'roomtypes': return <AdminProperty />;
    case 'menu': return <AdminMenu />;
    case 'staff': return <AdminTeam mode="staff" />;
    case 'formbuilder': return <AdminTeam mode="form" />;
    case 'qrcodes': return <AdminSystem mode="qrcodes" />;
    case 'settings': return <AdminSystem mode="settings" />;
    case 'audit': return <AdminSystem mode="audit" />;
    default: return <Insights mode="overview" />;
  }
}

function Shell() {
  const { user, snapshot, orders, requests, connected, logout, settings } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hash, setView] = useView();
  const allowed = useMemo(() => (user ? Object.keys(NAV).filter((key) => canSee(user.role, key)) : []), [user]);
  const fallback = ROLES[user?.role]?.home || 'overview';
  const view = allowed.includes(hash) ? hash : fallback;

  // Drive the view first, then the URL: if the fragment already matches (someone
  // pasted a link, or a guard sent us somewhere else) the click still works.
  const go = (next) => {
    setView(next);
    if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`;
    setOpen(false);
  };

  const badges = {
    orders: orders.filter((o) => o.status === 'new').length,
    deliveries: orders.filter((o) => o.status === 'delivering').length,
    rooms: requests.length,
    station: 0,
    housekeeping: snapshot?.housekeepingOpen,
    maintenance: snapshot?.maintenanceOpen,
  };

  const submitSearch = (event) => {
    if (event.key !== 'Enter') return;
    const term = search.trim().toLowerCase();
    if (!term) return;
    window.dispatchEvent(new CustomEvent('clove:search', { detail: term }));
    go('rooms');
    setSearch('');
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">{String(settings.hotel_name || 'CLOVE HOUSE').toUpperCase()}</div>
            <div className="brand-sub">HOTEL OPERATIONS</div>
          </div>
        </div>
        <div className="sidebar-scroll">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => allowed.includes(item) && NAV[item]);
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div className="nav-label">{group.label || (user.role === 'cashier' ? 'Front desk' : 'Workspace')}</div>
                {items.map((item) => (
                  <button key={item} data-view={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => go(item)}>
                    <Icon name={NAV[item].icon} size={16} />
                    <span>{NAV[item].label}</span>
                    {badges[item] ? <span className={`nav-badge ${item === 'orders' ? '' : 'teal'}`}>{badges[item]}</span> : null}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="sidebar-foot">
          <div className="user-block">
            <div className="user-avatar"><Icon name={ROLE_ICON[user.role] || 'user'} size={15} /></div>
            <div className="user-copy">
              <strong>{user.name}</strong>
              <span>{ROLES[user.role]?.label} · {connected ? 'live' : 'reconnecting…'}</span>
            </div>
            <button className="ghost-icon" onClick={logout} title="Sign out">
              <Icon name="log-out" size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setOpen((v) => !v)} aria-label="Open navigation">
              <Icon name="menu" size={18} />
            </button>
            <div className="crumbs">
              <span>{ROLES[user.role]?.label}</span>
              <span>/</span>
              <strong>{NAV[view]?.label || 'Overview'}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="search">
              <Icon name="search" size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={submitSearch}
                placeholder="Room number or guest name…"
                aria-label="Search"
              />
            </div>
            <button
              className="icon-btn"
              title={snapshot?.ordersNew ? `${snapshot.ordersNew} new order(s)` : 'No new orders'}
              onClick={() => go('orders')}
            >
              <Icon name="bell" size={17} />
              {snapshot?.ordersNew ? <i className="dot" /> : null}
            </button>
            <div className="clock">
              <Icon name="clock" size={14} />
              <span>{dayShort(Date.now())}</span>
            </div>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<ScreenLoading />}>
            <Screen view={view} onNavigate={go} />
          </Suspense>
        </main>
      </div>
      <Suspense fallback={null}>
        <NewOrderAlert onOpenOrders={() => go('orders')} />
      </Suspense>
      <Toasts />
    </div>
  );
}

function StaffApp() {
  const { user, loading } = useApp();
  if (!user) return <Login />;
  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--ink-faint)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 14px', background: 'var(--pine)', color: '#d9eee8' }}>C</div>
          Loading the hotel…
        </div>
      </div>
    );
  }
  return <Shell />;
}

export default function App() {
  const path = useRoute();
  const guest = path.match(/^\/(q|r)\/([\w-]+)/);

  return (
    <AppProvider>
      {guest ? (
        guest[1] === 'q' ? <GuestMenu token={guest[2]} /> : <GuestRegister token={guest[2]} />
      ) : (
        <StaffApp />
      )}
    </AppProvider>
  );
}
