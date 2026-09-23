import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Icon } from '../../lib/icons.jsx';
import { money } from '../../lib/format.js';

/**
 * The QR code at reception (or on the room door): the guest sees the room with
 * photos and price, then registers — the desk approves it from the room board.
 */
export default function GuestRegister({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(''); // the QR code itself could not be read
  const [formError, setFormError] = useState(''); // the guest has to fix something
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    api.public
      .get(`/public/room/${token}`)
      .then((result) => {
        setData(result);
        const initial = {};
        (result.fields || []).forEach((field) => {
          initial[field.key] = field.default || '';
        });
        setValues(initial);
      })
      .catch((err) => setError(err.message));
  }, [token]);

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
  if (!data) return null;

  const { hotel, room, fields = [], stay } = data;
  const photos = room.photos || [];

  const submit = async () => {
    const missing = fields.filter((field) => field.required && !String(values[field.key] || '').trim());
    if (missing.length) return setFormError(`Please fill in: ${missing.map((field) => field.label).join(', ')}`);
    setBusy(true);
    setFormError('');
    try {
      await api.public.post(`/public/register/${token}`, { fields: values });
      setDone(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="guest">
        <div className="guest-hero">
          <img src={photos[0]} alt="" />
          <div className="guest-wrap">
            <div className="brand-name" style={{ color: '#fff' }}>{String(hotel.name).toUpperCase()}</div>
          </div>
        </div>
        <div className="guest-wrap guest-body">
          <div className="card card-pad" style={{ marginTop: 16, textAlign: 'center' }}>
            <div className="avatar" style={{ margin: '6px auto 14px', width: 54, height: 54, background: 'var(--green-soft)', color: '#1f7a52' }}>
              <Icon name="check" size={26} />
            </div>
            <h1 style={{ fontSize: 26 }}>Thank you!</h1>
            <p className="page-desc" style={{ margin: '12px auto 0' }}>
              Your details were sent to the reception desk. A staff member will confirm your room and hand you the key — usually within a
              minute. Please keep this page open or come to the desk.
            </p>
            <div className="banner info" style={{ marginTop: 18, textAlign: 'left' }}>
              <Icon name="phone" size={15} />
              <span>Reception: {hotel.phone}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest">
      <div className="guest-hero">
        <img src={photos[photo]} alt="" />
        <div className="guest-wrap">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="brand-name" style={{ color: '#fff' }}>{String(hotel.name).toUpperCase()}</div>
            <span className={`pill ${room.status === 'available' ? 'available' : 'reserved'}`}>
              <i />{room.status === 'available' ? 'Available' : 'Ask the desk'}
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 27, marginTop: 14 }}>Room {room.number}</h1>
          <p style={{ color: '#d3e6e0', marginTop: 8, fontSize: 13 }}>
            {room.type} · {room.beds} · up to {room.max_guests} guest(s)
          </p>
        </div>
      </div>

      <div className="guest-wrap guest-body">
        <div className="stack">
          <div className="card card-pad">
            {photos.length > 1 ? (
              <div className="thumbs" style={{ marginBottom: 12 }}>
                {photos.map((src, index) => (
                  <button key={src} className={index === photo ? 'active' : ''} onClick={() => setPhoto(index)}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2>{room.type}</h2>
              <div style={{ textAlign: 'right' }}>
                <strong>{money(room.nightly_rate)}</strong>
                <div className="tiny muted">per night</div>
                {room.hourly_rate ? <div className="tiny muted">{money(room.hourly_rate)} per hour</div> : null}
                {room.dayuse_rate ? <div className="tiny muted">{money(room.dayuse_rate)} · {room.dayuse_hours}h day use</div> : null}
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 12, lineHeight: 1.65 }}>{room.description}</p>
            <div className="chips" style={{ marginTop: 12 }}>
              {(room.amenities || []).map((item) => <span className="chip" key={item}><Icon name="check" size={11} /> {item}</span>)}
            </div>
          </div>

          {stay ? (
            <div className="banner warn">
              <Icon name="alert" size={15} />
              <span>
                This room is currently occupied by {stay.guest_name}. If you would like to stay, please speak to the reception desk and they
                will find you another room.
              </span>
            </div>
          ) : (
            <div className="card card-pad">
              <h2>Register to check in</h2>
              <p className="small muted" style={{ marginTop: 8 }}>
                Fill in your details — the desk checks them and gives you the key. No paperwork.
              </p>
              {formError ? (
                <div className="banner bad" style={{ marginTop: 12 }}>
                  <Icon name="alert" size={15} />
                  <span>{formError}</span>
                </div>
              ) : null}
              <div className="form-grid" style={{ marginTop: 14 }}>
                {fields.map((field) => (
                  <div className={`field ${field.type === 'textarea' ? 'full' : ''}`} key={field.id}>
                    <label>
                      {field.label} {field.required ? <span className="req">*</span> : null}
                      {field.label_am ? <span className="muted"> · {field.label_am}</span> : null}
                    </label>
                    {field.type === 'select' ? (
                      <select value={values[field.key] || ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}>
                        <option value="">Choose…</option>
                        {(field.options || []).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={values[field.key] || ''}
                        placeholder={field.placeholder || ''}
                        onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy} onClick={submit}>
                {busy ? 'Sending…' : 'Send my details to reception'} <Icon name="arrow-right" size={16} />
              </button>
              <div className="tiny muted" style={{ marginTop: 10, textAlign: 'center' }}>
                Reception will confirm the room and the price with you before you pay anything.
              </div>
            </div>
          )}

          <div className="card card-pad">
            <h3 style={{ marginBottom: 10 }}>Good to know</h3>
            <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f6f5' }}>
              <span className="small">Checkout time</span>
              <strong className="small">{String(hotel.checkout_hour).padStart(2, '0')}:00</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f6f5' }}>
              <span className="small">Wi-Fi</span>
              <strong className="small">{hotel.wifi_name}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
              <span className="small">Reception</span>
              <strong className="small">{hotel.phone}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
