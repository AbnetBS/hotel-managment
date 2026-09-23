import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, clientRef } from '../../lib/api.js';
import { Icon } from '../../lib/icons.jsx';
import { money } from '../../lib/format.js';
import GuestHome from './GuestHome.jsx';
import GuestRequest from './GuestRequest.jsx';
import GuestBillCard, { useGuestMoney } from './GuestBillCard.jsx';

/**
 * The guest side of the QR code: three doors (menu + order, special request,
 * see bill). Everything is charged to the room, so the guest never needs cash,
 * a phone call or a walk to the desk.
 */
export default function GuestMenu({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState('home'); // home · menu · request · bill
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const ref = useRef(''); // one reference per attempt: retries cannot double-order

  const loadBill = useCallback(async () => {
    setBillLoading(true);
    try {
      const result = await api.public.get(`/public/bill/${token}`);
      setBill(result.bill);
    } catch {
      setBill(null);
    } finally {
      setBillLoading(false);
    }
  }, [token]);

  const loadMine = useCallback(async () => {
    try {
      const result = await api.public.get(`/public/requests/${token}`);
      setMyRequests(result.requests || []);
    } catch {
      setMyRequests([]);
    }
  }, [token]);

  useEffect(() => {
    api.public
      .get(`/public/menu/${token}`)
      .then((payload) => {
        setData(payload);
        loadMine();
      })
      .catch((err) => setError(err.message));
  }, [token, loadMine]);

  useEffect(() => {
    if (screen === 'bill') loadBill();
  }, [screen, loadBill]);

  const items = useMemo(() => {
    if (!data) return [];
    return category === 'all' ? data.items : data.items.filter((item) => item.category_id === category);
  }, [data, category]);

  if (error) {
    return (
      <div className="guest">
        <div className="guest-hero">
          <div className="guest-wrap">
            <h1 style={{ color: '#fff' }}>QR code not recognised</h1>
            <p style={{ color: '#cfe4de', marginTop: 10 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="guest">
        <div className="guest-hero"><div className="guest-wrap"><h1 style={{ color: '#fff' }}>Loading…</h1></div></div>
      </div>
    );
  }

  const { hotel, room, canOrder, requestKinds } = data;
  const total = cart.reduce((sum, line) => sum + line.price * line.qty, 0);

  const setQty = (item, qty) => {
    if (qty <= 0) setCart((current) => current.filter((line) => line.id !== item.id));
    else if (cart.some((line) => line.id === item.id)) setCart((current) => current.map((line) => (line.id === item.id ? { ...line, qty } : line)));
    else setCart((current) => [...current, { id: item.id, name: item.name, price: item.price, qty }]);
  };

  const send = async () => {
    setBusy(true);
    if (!ref.current) ref.current = clientRef('qr-order');
    try {
      const result = await api.public.post(`/public/order/${token}`, {
        items: cart.map((line) => ({ menu_item_id: line.id, qty: line.qty })),
        note,
        client_ref: ref.current,
      });
      ref.current = ''; // next order is a new one
      setSent(result);
      setCart([]);
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const open = (next) => {
    setSent(null);
    setScreen(next);
  };

  return (
    <div className="guest">
      <div className="guest-hero">
        <img src={room.photos?.[0]} alt="" />
        <div className="guest-wrap">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="brand-name" style={{ color: '#fff' }}>{String(hotel.name).toUpperCase()}</div>
            <span className={`pill ${canOrder ? 'available' : 'reserved'}`}><i />Room {room.number}</span>
          </div>
          {screen === 'home' ? (
            <>
              <h1 style={{ color: '#fff', fontSize: 27, marginTop: 14 }}>Good to see you</h1>
              <p style={{ color: '#d3e6e0', marginTop: 8, fontSize: 13 }}>
                {canOrder
                  ? 'Order food to the room, ask us for anything, or see your bill — all from here.'
                  : 'Please register at the reception desk, then everything here works.'}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="guest-wrap guest-body">
        {screen === 'home' ? (
          <GuestHome
            hotel={hotel}
            room={room}
            canOrder={canOrder}
            openRequests={myRequests}
            onOpen={open}
          />
        ) : null}

        {screen === 'request' ? (
          <GuestRequest
            token={token}
            room={room}
            kinds={requestKinds}
            onBack={() => open('home')}
            onDone={loadMine}
          />
        ) : null}

        {screen === 'bill' ? (
          <div className="stack">
            <button className="btn btn-ghost btn-sm" onClick={() => open('home')} style={{ alignSelf: 'flex-start' }}>
              <Icon name="arrow-left" size={15} /> Back
            </button>
            <GuestBillCard bill={bill} room={room} loading={billLoading} />
            <button className="btn btn-ghost" onClick={loadBill}>
              <Icon name="rotate-ccw" size={15} /> Refresh
            </button>
          </div>
        ) : null}

        {screen === 'menu' ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => open('home')}>
                <Icon name="arrow-left" size={15} /> Back
              </button>
              <span className="pill open"><i />Charged to Room {room.number}</span>
            </div>

            {sent ? (
              <div className="card card-pad" style={{ marginBottom: 14, textAlign: 'center' }}>
                <div className="avatar" style={{ margin: '6px auto 12px', width: 50, height: 50, background: 'var(--green-soft)', color: '#1f7a52' }}>
                  <Icon name="check" size={24} />
                </div>
                <h2 style={{ fontSize: 22 }}>Order #{sent.order.code} sent</h2>
                <p className="page-desc" style={{ margin: '10px auto 0' }}>
                  {sent.message} Total {money(sent.order.total)} — it goes on your room bill.
                </p>
                <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setSent(null)}>Order something else</button>
              </div>
            ) : null}

            <div className="chips" style={{ marginBottom: 12 }}>
              <button className={`chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategory('all')}>Everything</button>
              {data.categories.map((cat) => (
                <button key={cat.id} className={`chip ${category === cat.id ? 'on' : ''}`} onClick={() => setCategory(cat.id)}>
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="card card-pad">
              {items.map((item) => {
                const line = cart.find((entry) => entry.id === item.id);
                return (
                  <div className="menu-item" key={item.id}>
                    <div className="emoji">{item.emoji || '🍽️'}</div>
                    <div className="info">
                      <strong>{item.name}</strong>
                      {item.name_am ? <span style={{ color: 'var(--teal-dark)' }}>{item.name_am}</span> : null}
                      <span>{item.description}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="price">{money(item.price)}</div>
                      <div className="qty" style={{ marginTop: 8 }}>
                        <button onClick={() => setQty(item, (line?.qty || 0) - 1)} disabled={!line}>−</button>
                        <span>{line?.qty || 0}</span>
                        <button onClick={() => setQty(item, (line?.qty || 0) + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card card-pad" style={{ marginTop: 14 }}>
              <h3>Room {room.number} · {room.type}</h3>
              <p className="small muted" style={{ marginTop: 10, lineHeight: 1.65 }}>{room.description}</p>
              <div className="chips" style={{ marginTop: 12 }}>
                {(room.amenities || []).map((item) => <span className="chip" key={item}><Icon name="check" size={11} /> {item}</span>)}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {screen === 'menu' && cart.length ? (
        <div className="guest-cart">
          <div className="guest-cart-inner">
            <div style={{ flex: 1 }}>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Any note for the kitchen? (no pepper, extra injera…)"
                style={{ width: '100%', border: '1px solid var(--line-dark)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small muted">{cart.reduce((sum, line) => sum + line.qty, 0)} item(s)</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}>
              <Icon name="send" size={16} /> Send order
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { useGuestMoney };
