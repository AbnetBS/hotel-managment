/**
 * Demo / first-run data for Clove House.
 *
 *  node server/seed.js --reset     wipes the database and loads a fresh demo hotel
 *
 * Everything is dated relative to "now" so the countdown timers and the daily
 * reports always look alive when you open the app.
 */
import { db, id, nowIso, setSetting } from './db.js';
import { hashPin, randomToken } from './password.js';

const DAY = 86400 * 1000;
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

export function isSeeded() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
}

export function resetAll() {
  const tables = [
    'audit_log', 'checkin_requests', 'order_events', 'order_items', 'orders', 'folio_items', 'stays', 'reservations',
    'guests', 'menu_items', 'menu_categories', 'rooms', 'room_types', 'registration_fields', 'housekeeping_tasks',
    'maintenance_issues', 'users', 'settings',
  ];
  db.pragma('foreign_keys = OFF');
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
  db.pragma('foreign_keys = ON');
}

export function seed() {
  const now = Date.now();
  const today = dayStr(now);

  /* ------------------------------- settings ------------------------------- */
  const settings = {
    hotel_name: 'Clove House',
    property_line: 'Bole Road · Addis Ababa',
    property_code: 'CH-ADD-01',
    phone: '+251 11 662 4400',
    address: 'Bole Road, Addis Ababa, Ethiopia',
    currency: 'ETB',
    currency_symbol: 'ETB',
    vat_percent: 15,
    service_charge_percent: 10,
    checkout_hour: 12,
    grace_hours: 1,
    wifi_name: 'CloveHouse_Guest',
    wifi_password: 'welcome2026',
    receipt_footer: 'Thank you for staying with us — እንደገና ይመጡ!',
    dayuse_default_hours: 3,
    alert_sound: 1,
    require_call_confirmation: 1,
  };
  for (const [k, v] of Object.entries(settings)) setSetting(k, v);

  /* -------------------------------- users --------------------------------- */
  const staff = [
    ['u-admin', 'Marta Ayele', 'admin', 'admin', '+251 91 120 4455'],
    ['u-manager', 'Dawit Bekele', 'manager', 'manager', '+251 91 233 8877'],
    ['u-cashier', 'Hana Girma', 'cashier', 'cashier', '+251 92 145 2200'],
    ['u-cashier2', 'Meron Tadesse', 'meron', 'cashier', '+251 93 887 1122'],
    ['u-waiter', 'Yonas Tesfaye', 'waiter', 'waiter', '+251 91 774 3322'],
    ['u-kitchen', 'Chef Dawit Molla', 'kitchen', 'kitchen', '+251 91 662 0011'],
    ['u-barista', 'Bethlehem Alemu', 'barista', 'barista', '+251 92 553 7744'],
    ['u-juice', 'Samri Fikru', 'juice', 'juice', '+251 93 226 8899'],
    ['u-housekeeping', 'Tigist Mulatu', 'housekeeping', 'housekeeping', '+251 91 445 6677'],
  ];
  const insertUser = db.prepare(`INSERT INTO users (id, name, username, pin_hash, pin_salt, role, phone, active, created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  for (const [uid, name, username, role, phone] of staff) {
    const { hash, salt } = hashPin('1234');
    insertUser.run(uid, name, username, hash, salt, role, phone, nowIso());
  }

  /* ------------------------------ room types ------------------------------ */
  const roomTypes = [
    {
      id: 'rt-classic-single', name: 'Classic single', beds: '1 queen bed', max_guests: 1,
      description: 'A calm, compact room for one guest. Queen bed, hot shower, fast Wi-Fi and a proper work desk — everything you need for a short stay in Addis.',
      billing_mode: 'nightly', nightly_rate: 1800, hourly_rate: 400, dayuse_rate: 1200, dayuse_hours: 3,
      photos: ['/rooms/standard.jpg'],
      amenities: ['Free Wi-Fi', 'Hot shower', '32" TV', 'Work desk', 'Bottled water daily', 'Room service'],
    },
    {
      id: 'rt-classic-twin', name: 'Classic twin', beds: '2 single beds', max_guests: 2,
      description: 'Two separate beds with crisp linen, ideal for colleagues or friends travelling together. Quiet side of the building with a garden view.',
      billing_mode: 'nightly', nightly_rate: 2600, hourly_rate: 550, dayuse_rate: 1800, dayuse_hours: 3,
      photos: ['/rooms/twin.jpg'],
      amenities: ['Free Wi-Fi', 'Hot shower', '32" TV', 'Tea & coffee tray', 'Garden view', 'Room service'],
    },
    {
      id: 'rt-deluxe-king', name: 'Deluxe king', beds: '1 king bed', max_guests: 2,
      description: 'Spacious room with a king bed, sitting nook and a traditional Ethiopian coffee set. Our most requested room for couples and business guests.',
      billing_mode: 'nightly', nightly_rate: 3900, hourly_rate: 700, dayuse_rate: 2600, dayuse_hours: 3,
      photos: ['/rooms/deluxe-king.jpg'],
      amenities: ['Free Wi-Fi', 'King bed', 'Hot shower', '43" smart TV', 'Coffee set', 'Mini bar', 'City view'],
    },
    {
      id: 'rt-family-suite', name: 'Family suite', beds: '1 king · 2 singles', max_guests: 4,
      description: 'Two connected sleeping areas, perfect for families. Extra bedding on request, and a small dining table for in-room meals.',
      billing_mode: 'nightly', nightly_rate: 5200, hourly_rate: 900, dayuse_rate: 3400, dayuse_hours: 3,
      photos: ['/rooms/executive-suite.jpg', '/rooms/twin.jpg'],
      amenities: ['Free Wi-Fi', 'Two sleeping areas', 'Bathtub', 'Kids welcome', 'Mini fridge', 'Room service'],
    },
    {
      id: 'rt-executive-suite', name: 'Executive suite', beds: '1 king · 1 sofa bed', max_guests: 3,
      description: 'Suite with a separate living area and a wide city view. Popular with long-stay guests who work from the room.',
      billing_mode: 'nightly', nightly_rate: 6500, hourly_rate: 1100, dayuse_rate: 3800, dayuse_hours: 4,
      photos: ['/rooms/executive-suite.jpg'],
      amenities: ['Free Wi-Fi', 'Living area', 'Bathtub', 'Desk & lounge chair', 'Nespresso', 'Airport pickup'],
    },
    {
      id: 'rt-presidential', name: 'Presidential suite', beds: '1 king · 2 singles', max_guests: 4,
      description: 'Our finest suite: panoramic view, private lounge, dining for six and a dedicated service line.',
      billing_mode: 'nightly', nightly_rate: 9500, hourly_rate: 1600, dayuse_rate: 6000, dayuse_hours: 4,
      photos: ['/rooms/presidential.jpg'],
      amenities: ['Free Wi-Fi', 'Panoramic view', 'Private lounge', 'Dining for 6', 'Marble bathroom', 'Butler service'],
    },
  ];
  const insertType = db.prepare(`INSERT INTO room_types
    (id, name, description, billing_mode, nightly_rate, hourly_rate, dayuse_rate, dayuse_hours, max_guests, beds, amenities, photos, active, sort)
    VALUES (@id, @name, @description, @billing_mode, @nightly_rate, @hourly_rate, @dayuse_rate, @dayuse_hours, @max_guests, @beds, @amenities, @photos, 1, @sort)`);
  roomTypes.forEach((t, i) => insertType.run({ ...t, amenities: JSON.stringify(t.amenities), photos: JSON.stringify(t.photos), sort: i }));

  /* --------------------------------- rooms -------------------------------- */
  const rooms = [
    ['r-101', '101', 1, 'rt-classic-single', 'available'],
    ['r-102', '102', 1, 'rt-classic-twin', 'occupied'],
    ['r-103', '103', 1, 'rt-classic-single', 'cleaning'],
    ['r-104', '104', 1, 'rt-classic-twin', 'occupied'],
    ['r-201', '201', 2, 'rt-deluxe-king', 'available'],
    ['r-202', '202', 2, 'rt-classic-twin', 'available'],
    ['r-203', '203', 2, 'rt-deluxe-king', 'dirty'],
    ['r-204', '204', 2, 'rt-deluxe-king', 'occupied'],
    ['r-205', '205', 2, 'rt-family-suite', 'reserved'],
    ['r-206', '206', 2, 'rt-deluxe-king', 'available'],
    ['r-301', '301', 3, 'rt-executive-suite', 'occupied'],
    ['r-302', '302', 3, 'rt-executive-suite', 'maintenance'],
    ['r-303', '303', 3, 'rt-family-suite', 'available'],
    ['r-304', '304', 3, 'rt-deluxe-king', 'available', 'hourly'],
    ['r-305', '305', 3, 'rt-executive-suite', 'reserved'],
    ['r-306', '306', 3, 'rt-presidential', 'occupied'],
  ];
  const insertRoom = db.prepare(`INSERT INTO rooms (id, number, floor, room_type_id, status, billing_mode, qr_token, note, sort)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  rooms.forEach(([rid, number, floor, type, status, billingMode], i) => {
    insertRoom.run(rid, number, floor, type, status, billingMode || null, randomToken(8), null, i);
  });

  /* ------------------------- registration form fields --------------------- */
  const fields = [
    ['rf-name', 'full_name', 'Full name', 'ሙሉ ስም', 'text', 1, null, 'e.g. Abebe Kebede', null],
    ['rf-phone', 'phone', 'Phone number', 'ስልክ ቁጥር', 'phone', 1, null, '09xx xxx xxx', '+251'],
    ['rf-idtype', 'id_type', 'ID type', 'የመታወቂያ አይነት', 'select', 1, ['National ID (Kebele)', 'Passport', 'Driving licence', 'Residence permit', 'Company ID'], null, null],
    ['rf-idno', 'id_number', 'ID / passport number', 'የመታወቂያ ቁጥር', 'text', 1, null, 'FAN / passport number', null],
    ['rf-nation', 'nationality', 'Nationality', 'ዜግነት', 'text', 0, null, 'Ethiopian', 'Ethiopian'],
    ['rf-email', 'email', 'E-mail', 'ኢሜይል', 'email', 0, null, 'name@example.com', null],
    ['rf-address', 'address', 'Address', 'አድራሻ', 'text', 0, null, 'City, sub-city, woreda', null],
    ['rf-company', 'company', 'Company / organisation', 'ድርጅት', 'text', 0, null, 'Optional', null],
    ['rf-plate', 'plate_number', 'Vehicle plate number', 'የሰሌዳ ቁጥር', 'text', 0, null, 'e.g. AA 3 B 12345', null],
    ['rf-adults', 'adults', 'Number of guests', 'የእንግዶች ቁጥር', 'number', 1, null, '1', '1'],
    ['rf-emergency', 'emergency_contact', 'Emergency contact phone', 'የአደጋ ጊዜ ስልክ', 'phone', 0, null, 'Optional', null],
  ];
  const insertField = db.prepare(`INSERT INTO registration_fields (id, key, label, label_am, type, required, options, placeholder, sort, active)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  fields.forEach(([fid, key, label, am, type, required, options, placeholder, def], i) => {
    insertField.run(fid, key, label, am, type, required, options ? JSON.stringify({ options, default: def }) : def ? JSON.stringify({ default: def }) : null, placeholder, i);
  });

  /* -------------------------------- menu ---------------------------------- */
  const categories = [
    ['mc-breakfast', 'Breakfast', 'ቁርስ', 'kitchen', 0],
    ['mc-mains', 'Main dishes', 'ዋና ምግብ', 'kitchen', 1],
    ['mc-snacks', 'Snacks & sides', 'መክሰስ', 'kitchen', 2],
    ['mc-coffee', 'Coffee & hot drinks', 'ቡና', 'barista', 3],
    ['mc-cold', 'Juice & soft drinks', 'ጁስ', 'juice', 4],
    ['mc-bar', 'Bar', 'ባር', 'barista', 5],
  ];
  const insertCat = db.prepare('INSERT INTO menu_categories (id, name, name_am, station, sort, active) VALUES (?, ?, ?, ?, ?, 1)');
  for (const c of categories) insertCat.run(...c);

  const items = [
    ['mi-firfir', 'Firfir', 'ፍርፍር', 'Shredded injera in spicy berbere sauce with yoghurt', 260, 'mc-breakfast', 'kitchen', 12, '🍲'],
    ['mi-chechebsa', 'Chechebsa', 'ጨጨብሳ', 'Shredded kita tossed in berbere and niter kibbeh', 240, 'mc-breakfast', 'kitchen', 12, '🥞'],
    ['mi-eggs', 'Scrambled eggs', 'እንቁላል', 'Farm eggs with onion, tomato and bread', 220, 'mc-breakfast', 'kitchen', 10, '🍳'],
    ['mi-omelette', 'Cheese omelette', 'ኦምሌት', 'Three-egg omelette with cheese and salad', 280, 'mc-breakfast', 'kitchen', 12, '🍳'],
    ['mi-eggtibs', 'Egg with tibs', 'እንቁላል ከጥብስ', 'Fried eggs with beef tibs and bread', 380, 'mc-breakfast', 'kitchen', 15, '🍳'],
    ['mi-dorowat', 'Doro wat', 'ዶሮ ወጥ', 'Slow-cooked chicken stew with injera and ayib', 620, 'mc-mains', 'kitchen', 25, '🍗'],
    ['mi-beef-tibs', 'Beef tibs', 'የበሬ ጥብስ', 'Sautéed beef with rosemary, onion and injera', 580, 'mc-mains', 'kitchen', 20, '🥩'],
    ['mi-shiro', 'Shiro be wet', 'ሽሮ', 'Ground chickpea stew simmered in spices', 320, 'mc-mains', 'kitchen', 18, '🍲'],
    ['mi-beyaynetu', 'Beyaynetu', 'በያይነቱ', 'Fasting combination platter on injera', 380, 'mc-mains', 'kitchen', 18, '🥗'],
    ['mi-kitfo', 'Kitfo', 'ክትፎ', 'Minced beef warmed in mitmita and niter kibbeh', 640, 'mc-mains', 'kitchen', 22, '🥩'],
    ['mi-pasta', 'Chicken pasta', 'ፓስታ', 'Penne with grilled chicken in tomato cream', 460, 'mc-mains', 'kitchen', 20, '🍝'],
    ['mi-burger', 'Beef burger & chips', 'በርገር', 'House beef patty, cheese, salad and fries', 480, 'mc-mains', 'kitchen', 22, '🍔'],
    ['mi-club', 'Club sandwich', 'ክለብ ሳንድዊች', 'Triple-decker with chicken, egg and chips', 420, 'mc-mains', 'kitchen', 15, '🥪'],
    ['mi-sambusa', 'Sambusa (4 pcs)', 'ሳምቡሳ', 'Crisp pastry with lentil or beef filling', 120, 'mc-snacks', 'kitchen', 12, '🥟'],
    ['mi-chips', 'Chips firfir', 'ቺፕስ ፍርፍር', 'Fries tossed with berbere and tomato', 200, 'mc-snacks', 'kitchen', 12, '🍟'],
    ['mi-fruit', 'Fruit platter', 'የፍራፍሬ ትሪ', 'Seasonal fruit, cut to order', 280, 'mc-snacks', 'kitchen', 10, '🍉'],
    ['mi-coffee', 'Ethiopian coffee', 'የኢትዮጵያ ቡና', 'Single-origin, brewed the traditional way', 120, 'mc-coffee', 'barista', 8, '☕'],
    ['mi-macchiato', 'Macchiato', 'ማኪያቶ', 'Double espresso with steamed milk', 140, 'mc-coffee', 'barista', 6, '☕'],
    ['mi-espresso', 'Espresso', 'ኤስፕሬሶ', 'Rich single shot', 110, 'mc-coffee', 'barista', 5, '☕'],
    ['mi-tea', 'Black tea', 'ሻይ', 'With lemon or milk', 90, 'mc-coffee', 'barista', 5, '🫖'],
    ['mi-hotchoc', 'Hot chocolate', 'ሆት ቾኮሌት', 'Steamed milk and cocoa', 180, 'mc-coffee', 'barista', 7, '🍫'],
    ['mi-mango', 'Fresh mango juice', 'የማንጎ ጁስ', 'Pressed to order, no added sugar', 200, 'mc-cold', 'juice', 7, '🥭'],
    ['mi-avocado', 'Avocado juice', 'የአቮካዶ ጁስ', 'Creamy avocado with lime', 220, 'mc-cold', 'juice', 7, '🥑'],
    ['mi-papaya', 'Papaya juice', 'የፓፓያ ጁስ', 'Fresh papaya, lightly chilled', 200, 'mc-cold', 'juice', 7, '🍹'],
    ['mi-spris', 'Spris', 'ስፕሪስ', 'Layered avocado, mango and papaya', 240, 'mc-cold', 'juice', 9, '🍹'],
    ['mi-water', 'Bottled water', 'ውሃ', '500 ml · still', 40, 'mc-cold', 'juice', 2, '💧'],
    ['mi-ambo', 'Ambo mineral water', 'አምቦ', 'Sparkling · 500 ml', 60, 'mc-cold', 'juice', 2, '🫧'],
    ['mi-coke', 'Soft drink', 'ለስላሳ', 'Coca-Cola, Sprite or Fanta', 80, 'mc-cold', 'juice', 2, '🥤'],
    ['mi-beer', 'Local beer', 'ቢራ', 'St. George, Habesha or Dashen · 330 ml', 150, 'mc-bar', 'barista', 3, '🍺'],
    ['mi-wine', 'House wine (glass)', 'ወይን', 'Red or white, served by the glass', 320, 'mc-bar', 'barista', 3, '🍷'],
  ];
  const insertItem = db.prepare(`INSERT INTO menu_items (id, name, name_am, description, price, category_id, station, prep_minutes, available, emoji, sort)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
  items.forEach((it, i) => insertItem.run(it[0], it[1], it[2], it[3], it[4], it[5], it[6], it[7], it[8], i));

  /* ------------------------------- guests --------------------------------- */
  const guests = [
    ['g-selam', 'Selam Tesfaye', '+251 93 144 2088', 'selam.t@example.com', 'Ethiopian', 'National ID (Kebele)', 'AA-4432-991', { address: 'Bole, Addis Ababa', adults: '1' }],
    ['g-abebe', 'Abebe Kebede', '+251 91 556 7788', 'abebe.k@example.com', 'Ethiopian', 'National ID (Kebele)', 'AA-2201-118', { address: 'Kazanchis, Addis Ababa', company: 'Meta Trading PLC', adults: '1' }],
    ['g-john', 'John Doe', '+251 91 122 4500', 'john.doe@example.com', 'United States', 'Passport', 'P-77210934', { address: 'Chicago, IL, USA', adults: '2' }],
    ['g-nardos', 'Nardos Alemu', '+251 92 084 1190', 'nardos.a@example.com', 'Ethiopian', 'National ID (Kebele)', 'AA-8890-223', { address: 'CMC, Addis Ababa', adults: '2' }],
    ['g-embassy', 'Embassy Delegation', '+251 11 442 0193', 'protocol@embassy.example', 'Ethiopia', 'Company ID', 'CD-9920-1', { company: 'Embassy of the Republic', adults: '3', plate_number: 'CD 02 A 44' }],
    ['g-liam', 'Liam Osei', '+233 24 776 1122', 'liam.osei@example.com', 'Ghana', 'Passport', 'P-3391822', { adults: '1' }],
    ['g-mekdes', 'Mekdes Haile', '+251 94 332 1199', 'mekdes.h@example.com', 'Ethiopian', 'National ID (Kebele)', 'AA-7781-002', { adults: '1' }],
  ];
  const insertGuest = db.prepare(`INSERT INTO guests (id, full_name, phone, email, nationality, id_type, id_number, extra, created_at, created_by, source)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [gid, name, phone, email, nat, idType, idNo, extra] of guests) {
    insertGuest.run(gid, name, phone, email, nat, idType, idNo, JSON.stringify(extra), iso(now - 30 * DAY), 'u-cashier', 'cashier');
  }

  /* -------------------------------- stays --------------------------------- */
  const rateOf = (typeId) => roomTypes.find((t) => t.id === typeId).nightly_rate;
  const typeName = (typeId) => roomTypes.find((t) => t.id === typeId).name;

  const stays = [
    {
      id: 'stay-selam', code: 'ST-4101', guest: 'g-selam', room: 'r-102', type: 'rt-classic-twin',
      checkIn: now - 2 * DAY - 3 * HOUR, expected: now + 1 * DAY, mode: 'nightly', rate: rateOf('rt-classic-twin'), adults: 1,
      items: [
        ['food', 'Firfir × 1 · order #1031', 260],
        ['food', 'Ethiopian coffee × 2 · order #1031', 240],
        ['payment', 'Deposit · Cash', -3000, 'Cash'],
      ],
    },
    {
      id: 'stay-abebe', code: 'ST-4102', guest: 'g-abebe', room: 'r-104', type: 'rt-classic-twin',
      checkIn: now - 20 * HOUR, expected: now + 2 * DAY, mode: 'nightly', rate: rateOf('rt-classic-twin'), adults: 1,
      items: [
        ['food', 'Beef tibs × 1 · order #1037', 580],
        ['food', 'Ambo mineral water × 2 · order #1037', 120],
      ],
    },
    {
      id: 'stay-john', code: 'ST-4103', guest: 'g-john', room: 'r-204', type: 'rt-deluxe-king',
      checkIn: now - 6 * HOUR - 20 * 60 * 1000, expected: now + 6 * DAY, mode: 'nightly', rate: rateOf('rt-deluxe-king'), adults: 2,
      items: [
        ['payment', 'Deposit · Card', -4000, 'Card'],
      ],
    },
    {
      id: 'stay-nardos', code: 'ST-4104', guest: 'g-nardos', room: 'r-301', type: 'rt-executive-suite',
      checkIn: now - 3 * DAY - 5 * HOUR, expected: now + 1 * DAY, mode: 'nightly', rate: rateOf('rt-executive-suite'), adults: 2,
      items: [
        ['food', 'Doro wat × 2 · order #1039', 1240],
        ['food', 'Fresh mango juice × 2 · order #1039', 400],
        ['service', 'Airport transfer', 850],
        ['payment', 'Deposit · Bank transfer', -7000, 'Bank transfer'],
      ],
    },
    {
      id: 'stay-embassy', code: 'ST-4105', guest: 'g-embassy', room: 'r-306', type: 'rt-presidential',
      checkIn: now - 26 * HOUR, expected: now + 3 * DAY, mode: 'nightly', rate: rateOf('rt-presidential'), adults: 3,
      items: [
        ['service', 'Conference room · half day', 4200],
        ['payment', 'Deposit · Corporate account', -10000, 'Corporate account'],
      ],
    },
  ];

  const insertStay = db.prepare(`INSERT INTO stays (id, code, guest_id, room_id, billing_mode, rate, dayuse_hours, grace_hours,
      check_in_at, expected_out_at, check_out_at, status, discount, adults, children, source, note, created_by, created_at, updated_at)
      VALUES (@id, @code, @guest_id, @room_id, @billing_mode, @rate, @dayuse_hours, @grace_hours, @check_in_at, @expected_out_at,
      @check_out_at, @status, 0, @adults, 0, 'cashier', @note, 'u-cashier', @check_in_at, @check_in_at)`);
  const insertFolio = db.prepare(`INSERT INTO folio_items (id, stay_id, kind, description, qty, unit_price, amount, station, order_id, method, bill_date, void, created_at, created_by)
      VALUES (?, ?, ?, ?, 1, ?, ?, NULL, NULL, ?, ?, 0, ?, 'u-cashier')`);

  for (const s of stays) {
    insertStay.run({
      id: s.id, code: s.code, guest_id: s.guest, room_id: s.room, billing_mode: s.mode, rate: s.rate,
      dayuse_hours: 3, grace_hours: 1, check_in_at: iso(s.checkIn), expected_out_at: iso(s.expected),
      check_out_at: null, status: 'active', adults: s.adults || 1, note: null,
    });
    for (const [kind, description, amount, method] of s.items) {
      insertFolio.run(id('fi'), s.id, kind, description, Math.abs(amount), amount, method || null, dayStr(s.checkIn), iso(s.checkIn + 3 * HOUR));
    }
  }

  // Two closed stays from the last two days so reports have history.
  const closed = [
    { id: 'stay-liam', code: 'ST-4098', guest: 'g-liam', room: 'r-103', type: 'rt-classic-single', checkIn: now - 3 * DAY, out: now - 1 * DAY, mode: 'nightly', rate: rateOf('rt-classic-single'), items: [['room', 'Room charge · 2 nights', rateOf('rt-classic-single') * 2], ['food', 'Club sandwich × 1', 420], ['payment', 'Settle bill · Cash', -4020, 'Cash']] },
    { id: 'stay-mekdes', code: 'ST-4099', guest: 'g-mekdes', room: 'r-203', type: 'rt-deluxe-king', checkIn: now - 5 * HOUR - DAY, out: now - 2 * HOUR, mode: 'dayuse', rate: rateOf('rt-deluxe-king') * 0.66, items: [['room', 'Day use · 3 hours', Math.round(rateOf('rt-deluxe-king') * 0.66)], ['food', 'Chechebsa × 1', 240], ['food', 'Macchiato × 2', 280], ['payment', 'Settle bill · Mobile payment', -3094, 'Mobile payment']] },
  ];
  for (const c of closed) {
    insertStay.run({
      id: c.id, code: c.code, guest_id: c.guest, room_id: c.room, billing_mode: c.mode, rate: c.rate,
      dayuse_hours: 3, grace_hours: 1, check_in_at: iso(c.checkIn), expected_out_at: iso(c.out), check_out_at: iso(c.out),
      status: 'checked_out', adults: 1, note: null,
    });
    for (const [kind, description, amount, method] of c.items) {
      insertFolio.run(id('fi'), c.id, kind, description, Math.abs(amount), amount, method || null, dayStr(c.itemDate || c.checkIn), iso(c.checkIn + HOUR));
    }
  }

  /* -------------------------- reservations / tasks ------------------------ */
  const insertRes = db.prepare(`INSERT INTO reservations (id, code, guest_name, phone, room_id, room_type_id, arrival, departure, nights, rate, source, status, deposit, note, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'u-cashier')`);
  const resRows = [
    ['res-1', 'RES-2411', 'Amina Yusuf', '+251 91 220 3311', 'r-205', 'rt-family-suite', 2, 6, 5200, 'Phone', 'confirmed', 5000],
    ['res-2', 'RES-2414', 'Kebede Group (3 rooms)', '+251 11 466 7788', null, 'rt-deluxe-king', 3, 6, 3900, 'Corporate', 'confirmed', 12000],
    ['res-3', 'RES-2417', 'Hanna Worku', '+251 93 661 2244', 'r-305', 'rt-executive-suite', 2, 4, 6500, 'Walk-in', 'pending', 0],
    ['res-4', 'RES-2419', 'Tesfaye Regassa', '+251 91 887 3311', null, 'rt-classic-twin', 5, 7, 2600, 'Email', 'pending', 0],
  ];
  for (const [rid, code, name, phone, roomId, typeId, inDays, nights, rate, source, status, deposit] of resRows) {
    insertRes.run(rid, code, name, phone, roomId, typeId, dayStr(now + inDays * DAY), dayStr(now + (inDays + nights) * DAY), nights, rate, source, status, deposit,
      'Airport pickup requested', iso(now - 2 * DAY));
  }

  const insertHk = db.prepare('INSERT INTO housekeeping_tasks (id, room_id, type, assignee, priority, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertHk.run('hk-1', 'r-103', 'Turnover clean · checkout', 'Tigist Mulatu', 'high', 'in progress', 'Guest left at 10:05', iso(now - 2 * HOUR));
  insertHk.run('hk-2', 'r-203', 'Deep clean · day-use checkout', 'Unassigned', 'high', 'pending', 'Day-use guest left, remake bed', iso(now - 90 * 60 * 1000));
  insertHk.run('hk-3', 'r-302', 'Inspection after repair', 'Tigist Mulatu', 'normal', 'pending', 'Waiting for maintenance to finish AC', iso(now - 3 * HOUR));
  insertHk.run('hk-4', 'r-102', 'Stayover service', 'Rahel G.', 'low', 'completed', null, iso(now - 5 * HOUR));

  const insertMt = db.prepare('INSERT INTO maintenance_issues (id, room_id, issue, category, assignee, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertMt.run('MT-118', 'r-302', 'Air conditioner not cooling', 'HVAC', 'Yonas T.', 'high', 'in progress', iso(now - 6 * HOUR));
  insertMt.run('MT-117', 'r-205', 'Bathroom tap leaking', 'Plumbing', 'Samuel K.', 'normal', 'open', iso(now - DAY));
  insertMt.run('MT-114', 'r-104', 'TV remote not responding', 'Electronics', 'Samuel K.', 'low', 'open', iso(now - 2 * DAY));

  /* -------------------------------- orders -------------------------------- */
  const insertOrder = db.prepare(`INSERT INTO orders (id, code, room_id, stay_id, guest_name, channel, status, note, total, call_confirmed, charged,
      created_at, accepted_at, sent_at, ready_at, delivering_at, delivered_at, created_by, accepted_by)
      VALUES (@id, @code, @room_id, @stay_id, @guest_name, @channel, @status, @note, @total, @call_confirmed, @charged,
      @created_at, @accepted_at, @sent_at, @ready_at, @delivering_at, @delivered_at, @created_by, @accepted_by)`);
  const insertOrderItem = db.prepare(`INSERT INTO order_items (id, order_id, menu_item_id, name, name_am, qty, unit_price, station, status, note, accepted_at, done_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const mkOrder = (o) => {
    const total = o.items.reduce((sum, it) => sum + it.qty * it.price, 0);
    insertOrder.run({
      id: o.id, code: o.code, room_id: o.room, stay_id: o.stay, guest_name: o.guest, channel: o.channel, status: o.status,
      note: o.note || null, total, call_confirmed: o.callConfirmed ? 1 : 0, charged: o.charged ? 1 : 0,
      created_at: iso(o.at), accepted_at: o.accepted ? iso(o.at + 2 * 60 * 1000) : null, sent_at: o.sent ? iso(o.at + 3 * 60 * 1000) : null,
      ready_at: o.ready ? iso(o.at + 20 * 60 * 1000) : null, delivering_at: o.delivering ? iso(o.at + 22 * 60 * 1000) : null,
      delivered_at: o.delivered ? iso(o.at + 28 * 60 * 1000) : null, created_by: o.channel === 'qr' ? 'guest-qr' : 'u-cashier',
      accepted_by: o.accepted ? 'u-cashier' : null,
    });
    for (const it of o.items) {
      const menu = items.find((m) => m[1] === it.name);
      insertOrderItem.run(id('oi'), o.id, menu ? menu[0] : null, it.name, menu ? menu[2] : null, it.qty, it.price, it.station,
        it.status || 'new', it.note || null, it.status && it.status !== 'new' ? iso(o.at + 3 * 60 * 1000) : null,
        it.status === 'done' ? iso(o.at + 18 * 60 * 1000) : null);
    }
    db.prepare('INSERT INTO order_events (id, order_id, at, actor, type, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id('ev'), o.id, iso(o.at), o.channel === 'qr' ? `Room ${o.roomLabel || ''} guest (QR scan)` : 'Cashier', 'created', 'Order placed');
  };

  mkOrder({
    id: 'o-1041', code: '1041', room: 'r-204', stay: 'stay-john', guest: 'John Doe', roomLabel: '204', channel: 'qr', status: 'new',
    at: now - 4 * 60 * 1000, note: 'Please do not add pepper. Bring cutlery for two.',
    items: [
      { name: 'Beef tibs', qty: 2, price: 580, station: 'kitchen', status: 'new' },
      { name: 'Fresh mango juice', qty: 2, price: 200, station: 'juice', status: 'new' },
      { name: 'Ethiopian coffee', qty: 1, price: 120, station: 'barista', status: 'new' },
    ],
  });
  mkOrder({
    id: 'o-1040', code: '1040', room: 'r-301', stay: 'stay-nardos', guest: 'Nardos Alemu', roomLabel: '301', channel: 'qr', status: 'sent',
    at: now - 26 * 60 * 1000, accepted: true, sent: true, callConfirmed: true, note: 'No dairy',
    items: [
      { name: 'Pasta', qty: 1, price: 460, station: 'kitchen', status: 'done' },
      { name: 'Avocado juice', qty: 1, price: 220, station: 'juice', status: 'cooking' },
      { name: 'Macchiato', qty: 2, price: 140, station: 'barista', status: 'new' },
    ],
  });
  mkOrder({
    id: 'o-1039', code: '1039', room: 'r-301', stay: 'stay-nardos', guest: 'Nardos Alemu', roomLabel: '301', channel: 'outdoor', status: 'ready',
    at: now - 55 * 60 * 1000, accepted: true, sent: true, ready: true, callConfirmed: true,
    note: 'Guest called the front desk — deliver with extra injera.',
    items: [
      { name: 'Doro wat', qty: 2, price: 620, station: 'kitchen', status: 'done' },
      { name: 'Bottled water', qty: 2, price: 40, station: 'juice', status: 'done' },
    ],
  });
  mkOrder({
    id: 'o-1038', code: '1038', room: 'r-102', stay: 'stay-selam', guest: 'Selam Tesfaye', roomLabel: '102', channel: 'qr', status: 'delivering',
    at: now - 80 * 60 * 1000, accepted: true, sent: true, ready: true, delivering: true, callConfirmed: true,
    items: [{ name: 'Firfir', qty: 1, price: 260, station: 'kitchen', status: 'done' }],
  });
  mkOrder({
    id: 'o-1037', code: '1037', room: 'r-104', stay: 'stay-abebe', guest: 'Abebe Kebede', roomLabel: '104', channel: 'qr', status: 'delivered',
    at: now - 3 * HOUR, accepted: true, sent: true, ready: true, delivering: true, delivered: true, charged: true, callConfirmed: true,
    items: [
      { name: 'Beef tibs', qty: 1, price: 580, station: 'kitchen', status: 'done' },
      { name: 'Ambo mineral water', qty: 2, price: 60, station: 'juice', status: 'done' },
    ],
  });
  mkOrder({
    id: 'o-1036', code: '1036', room: null, stay: null, guest: 'Walk-in · Table 3', roomLabel: 'Table 3', channel: 'counter', status: 'completed',
    at: now - 4 * HOUR, accepted: true, sent: true, ready: true, delivering: true, delivered: true, charged: true, callConfirmed: true,
    items: [{ name: 'Club sandwich', qty: 1, price: 420, station: 'kitchen', status: 'done' }],
  });

  /* --------------------------- pending check-in ---------------------------- */
  db.prepare(`INSERT INTO checkin_requests (id, room_id, payload, status, note, created_at)
              VALUES (?, ?, ?, 'pending', ?, ?)`).run(
    'cr-1', 'r-201',
    JSON.stringify({ full_name: 'Sara Mekonnen', phone: '+251 91 338 2211', id_type: 'National ID (Kebele)', id_number: 'AA-5521-778', nationality: 'Ethiopian', adults: '2', address: 'Gerji, Addis Ababa' }),
    'Booked through QR scan at reception', iso(now - 12 * 60 * 1000),
  );

  db.prepare('INSERT INTO audit_log (id, at, actor_id, actor_name, role, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id('log'), nowIso(), 'u-admin', 'Marta Ayele', 'admin', 'seed', 'system', null, 'Demo hotel data loaded');

  return true;
}

export function ensureSeed() {
  if (isSeeded()) return false;
  seed();
  return true;
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  if (process.argv.includes('--reset')) {
    resetAll();
    seed();
    console.log('✓ Demo hotel reset with fresh rooms, guests, orders and staff (PIN 1234 for every account).');
  } else if (ensureSeed()) {
    console.log('✓ Demo hotel created (PIN 1234 for every account).');
  } else {
    console.log('Database already has data — nothing to do. Use: npm run reset-demo');
  }
}
