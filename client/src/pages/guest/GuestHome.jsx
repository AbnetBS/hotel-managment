import { Icon } from '../../lib/icons.jsx';

/**
 * What a guest sees after scanning the QR code on the bedside table:
 * three doors and nothing else — order, ask, pay.
 */
export default function GuestHome({ hotel, room, canOrder, openRequests, onOpen }) {
  const doors = [
    {
      key: 'menu',
      icon: 'utensils',
      title: 'Menu watch and order',
      am: 'ምናሌ ይመልከቱ እና ያዙ',
      text: 'See the full menu and send food or drinks to your room.',
    },
    {
      key: 'request',
      icon: 'bell',
      title: 'Special request',
      am: 'ልዩ ጥያቄ',
      text: 'Towels, water, laundry, taxi, something broken — one tap.',
    },
    {
      key: 'bill',
      icon: 'receipt',
      title: 'See bill',
      am: 'ሂሳብ ይመልከቱ',
      text: 'Everything charged to the room, and what is left to pay.',
    },
  ];

  return (
    <div className="guest-wrap guest-body">
      <div className="stack">
        <div className="guest-doors">
          {doors.map((door) => (
            <button key={door.key} type="button" className="guest-door" onClick={() => onOpen(door.key)}>
              <span className={`guest-door-icon ${door.key}`}><Icon name={door.icon} size={26} /></span>
              <span className="guest-door-copy">
                <strong>{door.title}</strong>
                <em>{door.am}</em>
                <span>{door.text}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>

        {!canOrder ? (
          <div className="banner warn">
            <Icon name="alert" size={15} />
            <span>This room is not checked in yet. Please register at the reception desk — you can still ask us for anything.</span>
          </div>
        ) : null}

        {openRequests?.length ? (
          <div className="card card-pad">
            <h3 style={{ marginBottom: 10 }}>We are already looking after</h3>
            {openRequests.map((request) => (
              <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f2f6f5' }} key={request.id}>
                <span className="small">
                  <Icon name="clock" size={12} /> {request.label}{request.note ? ` · ${request.note}` : ''}
                </span>
                <span className={`pill ${request.status === 'accepted' ? 'open' : 'reserved'}`}>
                  <i />{request.status === 'accepted' ? 'on the way' : 'received'}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 20px' }}>
          Wi-Fi {hotel?.wifi_name} · {hotel?.wifi_password} &nbsp;·&nbsp; Reception {hotel?.phone} &nbsp;·&nbsp; Checkout {String(hotel?.checkout_hour ?? 11).padStart(2, '0')}:00
        </p>
      </div>
    </div>
  );
}
