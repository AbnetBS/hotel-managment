import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { Icon } from '../../lib/icons.jsx';
import { money } from '../../lib/format.js';

/** What a guest sees after scanning the QR code on the room door or bedside. */
export default function GuestMenu({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('menu');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState(null);

  useEffect(() => {
    api.public
      .get(`/public/menu/${token}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (tab !== 'bill') return;
    api.public.get(`/public/bill/${token}`).then((result) => setBill(result.bill)).catch(() => setBill(null));
  }, [tab, token]);

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
        <div className="guest-hero"><div className="guest-wrap"><h1 style={{ color: '#fff' }}>{'Loading…'}</h1></div></div>
      </div>
    );
  }

  const { hotel, room, canOrder } = data;
  const total = cart.reduce((sum, line) => sum + line.price * line.qty, 0);

  const setQty = (item, qty) => {
    if (qty <= 0) setCart((current) => current.filter((line) => line.id !== item.id));
    else if (cart.some((line) => line.id === item.id)) setCart((current) => current.map((line) => (line.id === item.id ? { ...line, qty } : line)));
    else setCart((current) => [...current, { id: item.id, name: item.name, price: item.price, qty }]);
  };

  const send = async () => {
    setBusy(true);
    try {
      const result = await api.public.post(`/public/order/${token}`, {
        items: cart.map((line) => ({ menu_item_id: line.id, qty: line.qty })),
        note,
      });
      setSent(result);
      setCart([]);
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="guest">
        <div className="guest-hero">
          <img src={room.photos?.[0]} alt="" />
          <div className="guest-wrap">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="brand-name" style={{ color: '#fff' }}>{String(hotel.name).toUpperCase()}</div>
              <span className="pill available"><i />Room {room.number}</span>
            </div>
          </div>
        </div>
        <div className="guest-wrap guest-body">
          <div className="card card-pad" style={{ marginTop: 16, textAlign: 'center' }}>
            <div className="avatar" style={{ margin: '6px auto 14px', width: 54, height: 54, background: 'var(--green-soft)', color: '#1f7a52' }}>
              <Icon name="check" size={26} />
            </div>
            <h1 style={{ fontSize: 26 }}>Order #{sent.order.code} sent</h1>
            <p className="page-desc" style={{ margin: '12px auto 0' }}>
              {sent.message} The reception desk will call your room to confirm before it is prepared. Total {money(sent.order.total)} —
              it goes on your room bill.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => setSent(null)}>Order something else</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest">
      <div className="guest-hero">
        <img src={room.photos?.[0]} alt="" />
        <div className="guest-wrap">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="brand-name" style={{ color: '#fff' }}>{String(hotel.name).toUpperCase()}</div>
            <span className={`pill ${canOrder ? 'available' : 'reserved'}`}><i />Room {room.number}</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 27, marginTop: 14 }}>Good to see you</h1>
          <p style={{ color: '#d3e6e0', marginTop: 8, fontSize: 13 }}>
            {canOrder
              ? 'Order food and drinks to your room — it is charged to your bill automatically.'
              : 'This room is not checked in yet. Please register at the reception desk.'}
          </p>
        </div>
      </div>

      <div className="guest-wrap guest-body">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="seg">
            <button className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>Food &amp; drinks</button>
            <button className={tab === 'room' ? 'on' : ''} onClick={() => setTab('room')}>Your room</button>
            <button className={tab === 'bill' ? 'on' : ''} onClick={() => setTab('bill')}>Your bill</button>
          </div>
        </div>

        {tab === 'menu' ? (
          <>
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
          </>
        ) : null}

        {tab === 'room' ? (
          <div className="stack">
            <div className="card card-pad">
              <h2>Room {room.number} · {room.type}</h2>
              <p className="small muted" style={{ marginTop: 10, lineHeight: 1.65 }}>{room.description}</p>
              <div className="chips" style={{ marginTop: 12 }}>
                {(room.amenities || []).map((item) => <span className="chip" key={item}><Icon name="check" size={11} /> {item}</span>)}
              </div>
            </div>
            {room.photos?.length ? (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 12 }}>Photos</h3>
                <div className="gallery"><img src={room.photos[0]} alt="" /></div>
                <div className="thumbs">
                  {room.photos.map((photo) => <img key={photo} src={photo} alt="" style={{ width: 74, height: 54, objectFit: 'cover', borderRadius: 10 }} />)}
                </div>
              </div>
            ) : null}
            <div className="card card-pad">
              <h3 style={{ marginBottom: 12 }}>Practical information</h3>
              <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f6f5' }}>
                <span className="small"><Icon name="wifi" size={13} /> Wi-Fi</span>
                <strong className="small">{hotel.wifi_name}<span className="muted"> · {hotel.wifi_password}</span></strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f6f5' }}>
                <span className="small"><Icon name="clock" size={13} /> Checkout</span>
                <strong className="small">{String(hotel.checkout_hour).padStart(2, '0')}:00</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
                <span className="small"><Icon name="phone" size={13} /> Reception</span>
                <strong className="small">{hotel.phone}</strong>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'bill' ? (
          <div className="card card-pad">
            <h2>Your bill so far</h2>
            {!bill ? (
              <p className="small muted" style={{ marginTop: 12 }}>No open bill for this room yet.</p>
            ) : (
              <>
                <div className="bill" style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 12 }}>
                  {bill.lines.length === 0 ? (
                    <div className="bill-line"><div className="desc muted">Nothing ordered yet.</div><strong>{money(0)}</strong></div>
                  ) : (
                    bill.lines.map((line) => (
                      <div className="bill-line" key={line.id}>
                        <div className="desc">{line.description}</div>
                        <strong>{money(line.amount)}</strong>
                      </div>
                    ))
                  )}
                  <div className="bill-line">
                    <div className="desc">Service charge</div>
                    <strong>{money(bill.service)}</strong>
                  </div>
                  <div className="bill-line">
                    <div className="desc">VAT</div>
                    <strong>{money(bill.vat)}</strong>
                  </div>
                  <div className="bill-total due">
                    <span>Food &amp; drink total</span>
                    <span>{money(bill.total)}</span>
                  </div>
                </div>
                <div className="banner info" style={{ marginTop: 14 }}>
                  <Icon name="receipt" size={15} />
                  <span>{bill.note}</span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {tab === 'menu' && cart.length ? (
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
