import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from './api.js';

const AppContext = createContext(null);

function beep(times = 2) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    let when = ctx.currentTime;
    for (let i = 0; i < times; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 ? 700 : 960;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.22, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.3);
      when += 0.34;
    }
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* sound is a nice-to-have */
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [settings, setSettings] = useState({});
  const [snapshot, setSnapshot] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [stays, setStays] = useState([]);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [guestRequests, setGuestRequests] = useState([]);
  const [housekeeping, setHousekeeping] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(!!getStoredUser());

  const listeners = useRef(new Map());
  const toastId = useRef(0);

  const toast = useCallback((message, kind = 'success', ms = 4200) => {
    const id = (toastId.current += 1);
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), ms);
  }, []);

  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const subscribe = useCallback((topic, fn) => {
    const set = listeners.current.get(topic) || new Set();
    set.add(fn);
    listeners.current.set(topic, set);
    return () => set.delete(fn);
  }, []);

  const notify = useCallback((topic, payload) => {
    const set = listeners.current.get(topic);
    if (set) set.forEach((fn) => fn(payload));
  }, []);

  /* ------------------------------ loaders ------------------------------- */
  const loadRooms = useCallback(async () => setRooms((await api.get('/rooms')).rooms), []);
  const loadRoomTypes = useCallback(async () => setRoomTypes((await api.get('/bootstrap')).roomTypes), []);
  const loadMenu = useCallback(async () => setMenu((await api.get('/bootstrap')).menu), []);
  const loadStays = useCallback(async () => setStays((await api.get('/stays?status=active')).stays), []);
  const loadOrders = useCallback(async () => {
    const open =['new', 'accepted', 'sent', 'ready', 'delivering', 'delivered'];
    setOrders((await api.get(`/orders?status=${open.join(',')}&closed=1&limit=120`)).orders);
  }, []);
  const loadRequests = useCallback(async () => setRequests((await api.get('/checkin-requests?status=pending')).requests), []);
  const loadHousekeeping = useCallback(async () => setHousekeeping((await api.get('/housekeeping')).tasks), []);
  // Anything a guest asked for from the room: towels, water, laundry, taxi…
  const loadGuestRequests = useCallback(async () => setGuestRequests((await api.get('/requests?limit=120')).requests), []);
  const loadMaintenance = useCallback(async () => setMaintenance((await api.get('/maintenance')).issues), []);
  const loadReservations = useCallback(async () => setReservations((await api.get('/reservations')).reservations), []);
  const loadSnapshot = useCallback(async () => setSnapshot((await api.get('/me')).snapshot), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const boot = await api.get('/bootstrap');
      setUser(boot.user);
      setSession(getToken(), boot.user);
      setSettings(boot.settings);
      setSnapshot(boot.snapshot);
      setRooms(boot.rooms);
      setRoomTypes(boot.roomTypes);
      setMenu(boot.menu);
      setStays(boot.activeStays);
      setOrders(boot.openOrders);
      setRequests(boot.checkinRequests);
      setHousekeeping(boot.housekeeping);
      setMaintenance(boot.maintenance);
      setGuestRequests(boot.guestRequests || []);
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setUser(null);
      } else {
        toast(error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) loadAll();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------- live updates ----------------------------- */
  useEffect(() => {
    const token = getToken();
    if (!user || !token) return undefined;
    let socket;
    let retry;
    let closed = false;
    let pending = new Set();
    let timer;

    const flush = () => {
      const topics = pending;
      pending = new Set();
      if (topics.has('rooms') || topics.has('roomTypes')) { loadRooms(); loadSnapshot(); }
      if (topics.has('orders')) loadOrders();
      if (topics.has('stays')) loadStays();
      if (topics.has('folios')) { loadStays(); loadRooms(); }
      if (topics.has('menu')) loadMenu();
      if (topics.has('checkinRequests')) loadRequests();
      if (topics.has('housekeeping')) loadHousekeeping();
      if (topics.has('maintenance')) loadMaintenance();
      if (topics.has('requests')) loadGuestRequests();
      if (topics.has('inventory') || topics.has('lostfound') || topics.has('branches')) loadSnapshot();
      if (topics.has('reservations')) loadReservations();
      if (topics.has('reports')) loadSnapshot();
      topics.forEach((topic) => notify(topic, true));
    };

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2500);
      };
      socket.onerror = () => setConnected(false);
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'invalidate') {
          (message.topics || []).forEach((t) => pending.add(t));
          clearTimeout(timer);
          timer = setTimeout(flush, 350);
          return;
        }
        if (message.type === 'alert') {
          if (message.kind === 'order.new') {
            setAlerts((list) => (list.some((a) => a.order?.id === message.order?.id) ? list : [...list, message]));
            if (settings.alert_sound !== 0) beep(3);
            notify('alerts', message);
            return;
          }
          if (message.kind === 'order.delivering' && (user.role === 'waiter')) beep(2);
          if (message.kind === 'order.ready' && user.role === 'cashier') beep(2);
          if (['order.ready', 'order.delivered', 'checkin.request', 'order.delivering'].includes(message.kind)) beep(1);
          toast(message.title, message.kind === 'checkin.request' ? 'info' : 'success', 6000);
          notify('alerts', message);
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(timer);
      if (socket) socket.close();
    };
  }, [user?.id, user?.role, settings.alert_sound]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------- session ------------------------------ */
  const login = useCallback(async (username, pin) => {
    const result = await api.post('/auth/login', { username, pin });
    setSession(result.token, result.user);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* session may already be gone */
    }
    clearSession();
    setUser(null);
    setRooms([]);
    setOrders([]);
  }, []);

  const dismissAlert = useCallback((orderId) => setAlerts((list) => list.filter((a) => a.order?.id !== orderId)), []);

  const value = useMemo(
    () => ({
      user, settings, snapshot, rooms, roomTypes, menu, stays, orders, requests, guestRequests, housekeeping, maintenance, reservations,
      loading, connected, toasts, alerts,
      login, logout, toast, dismissToast, dismissAlert, subscribe, notify, loadAll, loadRooms, loadStays, loadOrders,
      loadRequests, loadSnapshot, loadHousekeeping, loadMaintenance, loadReservations, loadMenu, loadRoomTypes, loadGuestRequests,
    }),
    [user, settings, snapshot, rooms, roomTypes, menu, stays, orders, requests, guestRequests, housekeeping, maintenance, reservations,
      loading, connected, toasts, alerts, login, logout, toast, dismissToast, dismissAlert, subscribe, notify, loadAll],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

/** Re-render on every tick (used by the countdown clocks). */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

/** Subscribe to a live topic. */
export function useTopic(topic, fn) {
  const { subscribe } = useApp();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe(topic, () => ref.current?.()), [subscribe, topic]);
}
