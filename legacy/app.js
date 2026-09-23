/* Clove House — internal hotel operations demo application */

const iconPaths = {
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  door: '<path d="M5 20h14M7 20V4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V20M7 7h10M14 12h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4M17 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  users: '<path d="M16 20v-1.7a3.3 3.3 0 0 0-3.3-3.3H6.3A3.3 3.3 0 0 0 3 18.3V20M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1.5a3.3 3.3 0 0 0-2.5-3.2M16.5 3.1a4 4 0 0 1 0 7.8"/>',
  receipt: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  utensils: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c3 2 3 6 0 8"/>',
  'chef-hat': '<path d="M6 10.5a4 4 0 1 1 2.5-7.1A4.8 4.8 0 0 1 17 5.8a3.8 3.8 0 1 1 1 7.6H6a4 4 0 0 1 0-8Z"/><path d="M5 14v5h14v-5M8 19v2M16 19v2"/>',
  sparkles: '<path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3ZM19 14l-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14ZM4.5 14 4 15.5 2.5 16l1.5.5.5 1.5.5-1.5L6.5 16 5 15.5 4.5 14Z"/>',
  wrench: '<path d="m14.7 6.3 3-3a5 5 0 0 0-6.4 6.4l-7.5 7.5a2 2 0 1 0 2.8 2.8l7.5-7.5a5 5 0 0 0 6.4-6.4l-3 3-2.8.2-.2-2.8Z"/>',
  chart: '<path d="M4 19V5M4 19h17M8 16v-5M12 16V7M16 16v-3M20 16V4"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  'life-buoy': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m5.6 5.6 4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  'calendar-days': '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4M17 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  'layout-grid': '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M6 10V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3M3 20v-2M21 20v-2"/>',
  'more-vertical': '<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  'credit-card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  'banknote': '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h.01M18 15h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="m4 16-.8 4.8L8 20l11.4-11.4a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16Z M14 6l4 4M4 16l4 4"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  'log-out': '<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'clock-3': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'map-pin': '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M21 16.7v2.1a2 2 0 0 1-2.2 2 19 19 0 0 1-8.3-3 18.6 18.6 0 0 1-5.7-5.7 19 19 0 0 1-3-8.4A2 2 0 0 1 3.8 1.5h2.1a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.2 9.2a16 16 0 0 0 7.6 7.6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  'user-plus': '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>',
  'refresh-cw': '<path d="M20 11a8 8 0 0 0-14.9-4L3 10M4 5v5h5M4 13a8 8 0 0 0 14.9 4L21 14M20 19v-5h-5"/>',
  'building-2': '<path d="M3 21h18M5 21V5l7-3 7 3v16M9 21v-5h6v5M8 8h1M15 8h1M8 12h1M15 12h1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  'trending-up': '<path d="m3 17 6-6 4 4 7-8M15 7h5v5"/>',
  'trending-down': '<path d="m3 7 6 6 4-4 7 8M15 17h5v-5"/>',
  'alert-triangle': '<path d="m10.3 3.6-8 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  'clipboard-check': '<path d="M9 5h6M9 4a3 3 0 0 1 6 0M7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="m8 14 2.5 2.5L16 11"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>',
  'eye': '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
};

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (!el.querySelector('svg')) el.innerHTML = icon(el.dataset.icon, el.dataset.size || 16);
  });
}

const state = {
  view: 'dashboard',
  roomFilter: 'all',
  posCategory: 'All items',
  posContext: 'room',
  selectedStayId: 'stay-john',
  cart: [],
};

const rooms = [
  { number: '101', floor: 1, type: 'Classic single', beds: 1, bedConfig: '1 queen bed', max: 1, rate: 1200, status: 'available' },
  { number: '102', floor: 1, type: 'Classic twin', beds: 2, bedConfig: '2 single beds', max: 2, rate: 1650, status: 'occupied', guest: 'Selam Tesfaye', initials: 'ST', checkIn: 'Sep 19', checkOut: 'Sep 23' },
  { number: '103', floor: 1, type: 'Classic single', beds: 1, bedConfig: '1 queen bed', max: 1, rate: 1200, status: 'cleaning' },
  { number: '104', floor: 1, type: 'Garden double', beds: 1, bedConfig: '1 king bed', max: 2, rate: 2200, status: 'reserved', guest: 'Daniel Bekele', initials: 'DB', checkIn: 'Sep 22', checkOut: 'Sep 25' },
  { number: '201', floor: 2, type: 'Deluxe king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 2800, status: 'available' },
  { number: '202', floor: 2, type: 'Deluxe twin', beds: 2, bedConfig: '2 queen beds', max: 4, rate: 3200, status: 'occupied', guest: 'Mulugeta & Co.', initials: 'MC', checkIn: 'Sep 20', checkOut: 'Sep 24' },
  { number: '203', floor: 2, type: 'Deluxe king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 2800, status: 'dirty' },
  { number: '204', floor: 2, type: 'Deluxe king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 3000, status: 'occupied', guest: 'John Doe', initials: 'JD', checkIn: 'Sep 21', checkOut: 'Sep 28', stayId: 'stay-john' },
  { number: '205', floor: 2, type: 'Family suite', beds: 3, bedConfig: '1 king · 2 singles', max: 4, rate: 4500, status: 'reserved', guest: 'Amina Yusuf', initials: 'AY', checkIn: 'Sep 22', checkOut: 'Sep 27' },
  { number: '206', floor: 2, type: 'Deluxe twin', beds: 2, bedConfig: '2 queen beds', max: 4, rate: 3200, status: 'available' },
  { number: '301', floor: 3, type: 'Executive king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 3900, status: 'occupied', guest: 'Lars Nilsson', initials: 'LN', checkIn: 'Sep 18', checkOut: 'Sep 23' },
  { number: '302', floor: 3, type: 'Executive king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 3900, status: 'maintenance' },
  { number: '303', floor: 3, type: 'Executive twin', beds: 2, bedConfig: '2 queen beds', max: 4, rate: 4200, status: 'available' },
  { number: '304', floor: 3, type: 'Executive suite', beds: 2, bedConfig: '1 king · 1 sofa bed', max: 3, rate: 5200, status: 'occupied', guest: 'Nardos Alemu', initials: 'NA', checkIn: 'Sep 17', checkOut: 'Sep 22' },
  { number: '305', floor: 3, type: 'Executive king', beds: 1, bedConfig: '1 king bed', max: 2, rate: 3900, status: 'available' },
  { number: '306', floor: 3, type: 'Presidential suite', beds: 2, bedConfig: '1 king · 2 singles', max: 4, rate: 6500, status: 'reserved', guest: 'Embassy Delegation', initials: 'ED', checkIn: 'Sep 24', checkOut: 'Sep 29' },
];

const stays = [
  { id: 'stay-john', guest: 'John Doe', initials: 'JD', room: '204', type: 'Deluxe king', arrival: 'Sep 21, 2026', departure: 'Sep 28, 2026', nights: 7, phone: '+251 91 122 4500', email: 'john.doe@example.com', nationality: 'United States', rate: 3000, transactions: [
    { id: 'tx-1', date: 'Sep 21', type: 'Room', description: 'Room charge · Night 1', amount: 3000 },
    { id: 'tx-2', date: 'Sep 21', type: 'Food & Beverage', description: 'Breakfast × 1 · Order #1042', amount: 450 },
    { id: 'tx-3', date: 'Sep 21', type: 'Food & Beverage', description: 'Coffee × 1 · Order #1042', amount: 120 },
    { id: 'tx-4', date: 'Sep 22', type: 'Room', description: 'Room charge · Night 2', amount: 3000 },
    { id: 'tx-5', date: 'Sep 22', type: 'Services', description: 'Laundry · 4 items', amount: 450 },
    { id: 'tx-6', date: 'Sep 22', type: 'Payment', description: 'Deposit · Cash', amount: -2000, method: 'Cash' },
  ] },
  { id: 'stay-selam', guest: 'Selam Tesfaye', initials: 'ST', room: '102', type: 'Classic twin', arrival: 'Sep 19, 2026', departure: 'Sep 23, 2026', nights: 4, phone: '+251 93 144 2088', email: 'selam.t@example.com', nationality: 'Ethiopia', rate: 1650, transactions: [
    { id: 'tx-7', date: 'Sep 19', type: 'Room', description: 'Room charge · Night 1', amount: 1650 },
    { id: 'tx-8', date: 'Sep 20', type: 'Room', description: 'Room charge · Night 2', amount: 1650 },
    { id: 'tx-9', date: 'Sep 20', type: 'Food & Beverage', description: 'Dinner · Order #1039', amount: 780 },
    { id: 'tx-10', date: 'Sep 20', type: 'Payment', description: 'Deposit · Bank transfer', amount: -3000, method: 'Bank transfer' },
  ] },
  { id: 'stay-mulugeta', guest: 'Mulugeta & Co.', initials: 'MC', room: '202', type: 'Deluxe twin', arrival: 'Sep 20, 2026', departure: 'Sep 24, 2026', nights: 4, phone: '+251 11 442 0193', email: 'office@mulugeta.co', nationality: 'Ethiopia', rate: 3200, transactions: [
    { id: 'tx-11', date: 'Sep 20', type: 'Room', description: 'Room charge · Night 1', amount: 3200 },
    { id: 'tx-12', date: 'Sep 21', type: 'Room', description: 'Room charge · Night 2', amount: 3200 },
    { id: 'tx-13', date: 'Sep 21', type: 'Services', description: 'Airport transfer', amount: 850 },
    { id: 'tx-14', date: 'Sep 20', type: 'Payment', description: 'Deposit · Card', amount: -4000, method: 'Card' },
  ] },
  { id: 'stay-lars', guest: 'Lars Nilsson', initials: 'LN', room: '301', type: 'Executive king', arrival: 'Sep 18, 2026', departure: 'Sep 23, 2026', nights: 5, phone: '+46 70 224 881', email: 'lars.n@example.com', nationality: 'Sweden', rate: 3900, transactions: [
    { id: 'tx-15', date: 'Sep 18', type: 'Room', description: 'Room charge · Night 1', amount: 3900 },
    { id: 'tx-16', date: 'Sep 19', type: 'Room', description: 'Room charge · Night 2', amount: 3900 },
    { id: 'tx-17', date: 'Sep 19', type: 'Food & Beverage', description: 'Dinner · Order #1031', amount: 1100 },
    { id: 'tx-18', date: 'Sep 18', type: 'Payment', description: 'Deposit · Card', amount: -5000, method: 'Card' },
  ] },
  { id: 'stay-nardos', guest: 'Nardos Alemu', initials: 'NA', room: '304', type: 'Executive suite', arrival: 'Sep 17, 2026', departure: 'Sep 22, 2026', nights: 5, phone: '+251 92 084 1190', email: 'nardos.a@example.com', nationality: 'Ethiopia', rate: 5200, transactions: [
    { id: 'tx-19', date: 'Sep 17', type: 'Room', description: 'Room charge · Night 1', amount: 5200 },
    { id: 'tx-20', date: 'Sep 18', type: 'Room', description: 'Room charge · Night 2', amount: 5200 },
    { id: 'tx-21', date: 'Sep 18', type: 'Services', description: 'Conference services', amount: 1600 },
    { id: 'tx-22', date: 'Sep 17', type: 'Payment', description: 'Deposit · Mobile payment', amount: -7000, method: 'Mobile payment' },
  ] },
];

const reservations = [
  { id: 'RES-2409', guest: 'Daniel Bekele', initials: 'DB', room: '104', roomType: 'Garden double', dates: 'Sep 22 → Sep 25', nights: 3, source: 'Direct', status: 'confirmed', amount: 6600 },
  { id: 'RES-2411', guest: 'Amina Yusuf', initials: 'AY', room: '205', roomType: 'Family suite', dates: 'Sep 22 → Sep 27', nights: 5, source: 'Phone', status: 'confirmed', amount: 22500 },
  { id: 'RES-2414', guest: 'Kebede Group', initials: 'KG', room: '—', roomType: 'Deluxe twin · 3 rooms', dates: 'Sep 24 → Sep 27', nights: 3, source: 'Corporate', status: 'pending', amount: 28800 },
  { id: 'RES-2417', guest: 'Mekdes Haile', initials: 'MH', room: '—', roomType: 'Classic single', dates: 'Sep 26 → Sep 29', nights: 3, source: 'Email', status: 'pending', amount: 3600 },
  { id: 'RES-2398', guest: 'Liam Osei', initials: 'LO', room: '201', roomType: 'Deluxe king', dates: 'Sep 19 → Sep 21', nights: 2, source: 'Direct', status: 'checked out', amount: 5600 },
  { id: 'RES-2387', guest: 'Hana Worku', initials: 'HW', room: '103', roomType: 'Classic single', dates: 'Sep 15 → Sep 17', nights: 2, source: 'Phone', status: 'cancelled', amount: 2400 },
];

const menuItems = [
  { id: 'm1', name: 'Clove breakfast', description: 'Eggs, sourdough, fruit & coffee', price: 450, category: 'Breakfast', emoji: '🍳', photo: 'breakfast' },
  { id: 'm2', name: 'Avocado toast', description: 'Sourdough, avocado, dukkah', price: 380, category: 'Breakfast', emoji: '🥑', photo: 'breakfast' },
  { id: 'm3', name: 'Chicken tibs', description: 'Sautéed chicken, injera & salad', price: 650, category: 'Mains', emoji: '🍗', photo: 'mains' },
  { id: 'm4', name: 'Shiro platter', description: 'Traditional shiro, injera & sides', price: 520, category: 'Mains', emoji: '🍲', photo: 'mains' },
  { id: 'm5', name: 'Pasta primavera', description: 'Seasonal vegetables, herbs & parmesan', price: 590, category: 'Mains', emoji: '🍝', photo: 'mains' },
  { id: 'm6', name: 'Fresh juice', description: 'Orange, mango or pineapple', price: 220, category: 'Drinks', emoji: '🍹', photo: 'drinks' },
  { id: 'm7', name: 'Sparkling water', description: '330 ml bottle', price: 120, category: 'Drinks', emoji: '🫧', photo: 'drinks' },
  { id: 'm8', name: 'Ethiopian coffee', description: 'Single origin · traditional service', price: 120, category: 'Beverages', emoji: '☕', photo: 'beverages' },
  { id: 'm9', name: 'Macchiato', description: 'Espresso with steamed milk', price: 150, category: 'Beverages', emoji: '☕', photo: 'beverages' },
];

const kitchenOrders = [
  { id: '1042', location: 'Room 204', guest: 'John Doe', time: '08:41', status: 'new', priority: 'Standard', items: [{ name: 'Clove breakfast', qty: 1 }, { name: 'Coffee', qty: 1 }], note: 'Deliver to room · Charge to folio' },
  { id: '1043', location: 'Table 7', guest: 'Walk-in guest', time: '08:46', status: 'accepted', priority: 'Standard', items: [{ name: 'Chicken tibs', qty: 2 }, { name: 'Fresh juice', qty: 2 }] },
  { id: '1044', location: 'Room 301', guest: 'Lars Nilsson', time: '09:02', status: 'preparing', priority: 'Priority', items: [{ name: 'Pasta primavera', qty: 1 }, { name: 'Sparkling water', qty: 1 }], note: 'No dairy' },
  { id: '1041', location: 'Table 3', guest: 'Walk-in guest', time: '08:18', status: 'ready', priority: 'Standard', items: [{ name: 'Shiro platter', qty: 1 }] },
  { id: '1038', location: 'Room 202', guest: 'Mulugeta & Co.', time: '07:51', status: 'served', priority: 'Standard', items: [{ name: 'Breakfast', qty: 2 }] },
];

const housekeepingTasks = [
  { id: 'hk1', room: '103', type: 'Turnover clean', assignee: 'Tigist M.', priority: 'high', status: 'in progress', created: '08:12' },
  { id: 'hk2', room: '203', type: 'Deep clean · checkout', assignee: 'Rahel G.', priority: 'normal', status: 'pending', created: '07:48' },
  { id: 'hk3', room: '304', type: 'Refresh & amenities', assignee: 'Tigist M.', priority: 'normal', status: 'pending', created: '08:35' },
  { id: 'hk4', room: '102', type: 'Stayover service', assignee: 'Marta K.', priority: 'low', status: 'completed', created: '07:30' },
  { id: 'hk5', room: '201', type: 'Inspection', assignee: 'Ruth B.', priority: 'normal', status: 'pending', created: '08:05' },
  { id: 'hk6', room: '101', type: 'Linen replacement', assignee: 'Marta K.', priority: 'low', status: 'completed', created: '07:25' },
];

const maintenanceIssues = [
  { id: 'MT-118', room: '302', issue: 'Air conditioning not cooling', category: 'HVAC', assignee: 'Yonas T.', priority: 'high', status: 'open', created: 'Today, 07:18' },
  { id: 'MT-117', room: '205', issue: 'Bathroom tap leaking', category: 'Plumbing', assignee: 'Samuel K.', priority: 'normal', status: 'in progress', created: 'Yesterday, 16:40' },
  { id: 'MT-114', room: '104', issue: 'TV remote not responding', category: 'Electronics', assignee: 'Yonas T.', priority: 'low', status: 'open', created: 'Yesterday, 14:22' },
  { id: 'MT-109', room: '301', issue: 'Replace bedside lamp', category: 'Furniture', assignee: 'Samuel K.', priority: 'low', status: 'resolved', created: 'Sep 20, 11:05' },
];

function fmt(amount, currency = 'ETB') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount).replace('ETB', 'ETB');
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}
function initials(name) { return String(name).split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
function getStay(id = state.selectedStayId) { return stays.find(x => x.id === id) || stays[0]; }
function charges(stay) { return stay.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0); }
function payments(stay) { return Math.abs(stay.transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)); }
function balance(stay) { return charges(stay) - payments(stay); }
function roomStatusLabel(status) { return ({ available: 'Available', occupied: 'Occupied', reserved: 'Reserved', cleaning: 'Cleaning', dirty: 'Dirty', maintenance: 'Maintenance', inspected: 'Inspected' })[status] || status; }
function statusPill(status) { return `<span class="status-pill ${status.replace(/\s/g, '-').toLowerCase()}">${esc(status.charAt(0).toUpperCase() + status.slice(1))}</span>`; }
function pageHeader(eyebrow, title, description, actions = '') {
  return `<div class="page-header"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="page-description">${description}</p></div><div class="page-actions">${actions}</div></div>`;
}
function actionButton(label, action, iconName = 'plus', cls = 'btn-primary', extra = '') {
  return `<button class="btn ${cls}" data-action="${action}" ${extra}>${icon(iconName, 14)}<span>${label}</span></button>`;
}

function renderDashboard() {
  const available = rooms.filter(r => r.status === 'available').length;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const inService = rooms.filter(r => ['cleaning', 'dirty', 'maintenance'].includes(r.status)).length;
  return `
    ${pageHeader('Monday · September 21, 2026', 'Good morning, Marta', 'Here is what is happening across Clove House right now.', `${actionButton('Walk-in check-in', 'open-checkin', 'user-plus', 'btn')} ${actionButton('New reservation', 'open-reservation', 'plus')} `)}
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-head"><span>Occupancy today</span><span class="stat-icon teal">${icon('building-2', 15)}</span></div><div class="stat-value">${Math.round((occupied / rooms.length) * 100)}<small>%</small></div><div class="stat-foot"><span class="trend-up">+4.8%</span><span>vs. last Monday</span></div></div>
      <div class="stat-card"><div class="stat-head"><span>Rooms occupied</span><span class="stat-icon blue">${icon('door', 15)}</span></div><div class="stat-value">${occupied}<small> / ${rooms.length}</small></div><div class="stat-foot"><span class="trend-up">${available} available</span><span>· ${inService} in service</span></div></div>
      <div class="stat-card"><div class="stat-head"><span>Arrivals today</span><span class="stat-icon amber">${icon('arrow-right', 15)}</span></div><div class="stat-value">12</div><div class="stat-foot"><span class="trend-up">8 checked in</span><span>· 4 expected</span></div></div>
      <div class="stat-card"><div class="stat-head"><span>Revenue today</span><span class="stat-icon coral">${icon('trending-up', 15)}</span></div><div class="stat-value">${fmt(48250)}</div><div class="stat-foot"><span class="trend-up">+12.6%</span><span>vs. last Monday</span></div></div>
    </div>
    <div class="content-grid grid-main">
      <section class="card occupancy-card"><div class="card-header"><div><div class="card-title">Occupancy performance</div><div class="card-subtitle">Rooms occupied across the last 7 days</div></div><div class="chart-filters"><button class="active">7 days</button><button>30 days</button><button>90 days</button></div></div><div class="occupancy-summary"><strong>64.6%</strong><span>${icon('trending-up', 11)} 8.2%</span></div><div class="chart-wrap"><svg viewBox="0 0 700 185" preserveAspectRatio="none" role="img" aria-label="Occupancy chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#70b5a2" stop-opacity=".35"/><stop offset="1" stop-color="#70b5a2" stop-opacity=".02"/></linearGradient></defs><line class="chart-grid-line" x1="42" y1="23" x2="680" y2="23"/><line class="chart-grid-line" x1="42" y1="68" x2="680" y2="68"/><line class="chart-grid-line" x1="42" y1="113" x2="680" y2="113"/><line class="chart-grid-line" x1="42" y1="158" x2="680" y2="158"/><text class="chart-label" x="5" y="27">100%</text><text class="chart-label" x="12" y="72">75%</text><text class="chart-label" x="12" y="117">50%</text><text class="chart-label" x="12" y="162">25%</text><path class="chart-area" d="M42 92 C92 82 104 104 144 88 S207 60 248 74 S315 45 356 61 S423 52 460 70 S510 58 548 50 S605 72 680 39 L680 158 L42 158Z"/><path class="chart-line" d="M42 92 C92 82 104 104 144 88 S207 60 248 74 S315 45 356 61 S423 52 460 70 S510 58 548 50 S605 72 680 39"/><circle class="chart-point" cx="42" cy="92" r="3.5"/><circle class="chart-point" cx="144" cy="88" r="3.5"/><circle class="chart-point" cx="248" cy="74" r="3.5"/><circle class="chart-point" cx="356" cy="61" r="3.5"/><circle class="chart-point" cx="460" cy="70" r="3.5"/><circle class="chart-point" cx="548" cy="50" r="3.5"/><circle class="chart-point" cx="680" cy="39" r="3.5"/><text class="chart-label" x="40" y="177">Sep 15</text><text class="chart-label" x="140" y="177">16</text><text class="chart-label" x="243" y="177">17</text><text class="chart-label" x="351" y="177">18</text><text class="chart-label" x="455" y="177">19</text><text class="chart-label" x="543" y="177">20</text><text class="chart-label" x="660" y="177">Today</text></svg></div><div class="chart-legend"><span><i class="legend-dot teal"></i>Occupied rooms</span><span><i class="legend-dot gray"></i>${rooms.length} total rooms</span></div></section>
      <section class="card card-padding"><div class="card-header"><div><div class="card-title">Today’s movement</div><div class="card-subtitle">Arrivals & departures</div></div><button class="card-link" data-view="reservations">View all ${icon('arrow-right', 11)}</button></div><div class="arrival-list"><div class="arrival-row"><div class="avatar green">DB</div><div><div class="row-primary">Daniel Bekele</div><div class="row-secondary">Room 104 · Arrival</div></div><div class="arrival-meta"><div class="arrival-time">10:30</div><div class="arrival-label">in 42 min</div></div></div><div class="arrival-row"><div class="avatar blue">NA</div><div><div class="row-primary">Nardos Alemu</div><div class="row-secondary">Room 304 · Departure</div></div><div class="arrival-meta"><div class="arrival-time">12:00</div><div class="arrival-label">in 1h 12m</div></div></div><div class="arrival-row"><div class="avatar yellow">AY</div><div><div class="row-primary">Amina Yusuf</div><div class="row-secondary">Room 205 · Arrival</div></div><div class="arrival-meta"><div class="arrival-time">14:00</div><div class="arrival-label">in 3h 12m</div></div></div><div class="arrival-row"><div class="avatar purple">KG</div><div><div class="row-primary">Kebede Group</div><div class="row-secondary">3 rooms · Arrival</div></div><div class="arrival-meta"><div class="arrival-time">16:30</div><div class="arrival-label">in 5h 42m</div></div></div></div></section>
    </div>
    <div class="content-grid grid-main" style="margin-top:17px;">
      <section class="card card-padding revenue-card"><div class="card-header"><div><div class="card-title">Revenue mix</div><div class="card-subtitle">Today · all departments</div></div><button class="card-link" data-view="reports">Full report ${icon('arrow-right', 11)}</button></div><div class="revenue-total">${fmt(48250)} <span class="revenue-period">today</span></div><div class="revenue-bars"><div><div class="revenue-bar-top"><span>Room revenue</span><strong>${fmt(33250)}</strong></div><div class="bar-track"><div class="bar-fill room"></div></div></div><div><div class="revenue-bar-top"><span>Food & beverage</span><strong>${fmt(10100)}</strong></div><div class="bar-track"><div class="bar-fill food"></div></div></div><div><div class="revenue-bar-top"><span>Services</span><strong>${fmt(3400)}</strong></div><div class="bar-track"><div class="bar-fill service"></div></div></div><div><div class="revenue-bar-top"><span>Other revenue</span><strong>${fmt(1500)}</strong></div><div class="bar-track"><div class="bar-fill other"></div></div></div></div></section>
      <section class="card card-padding queue-card"><div class="card-header"><div><div class="card-title">Operations queue</div><div class="card-subtitle">Items that need attention</div></div><span class="status-pill pending">6 open</span></div><div class="queue-list"><div class="queue-item"><div class="queue-icon coral">${icon('sparkles', 14)}</div><div><strong>3 rooms need cleaning</strong><span>103, 203 and 304 after departures</span></div><span class="queue-status urgent">Urgent</span></div><div class="queue-item"><div class="queue-icon amber">${icon('wrench', 14)}</div><div><strong>AC issue · Room 302</strong><span>Assigned to Yonas T. · 1h ago</span></div><span class="queue-status pending">Open</span></div><div class="queue-item"><div class="queue-icon blue">${icon('chef-hat', 14)}</div><div><strong>4 kitchen orders</strong><span>2 new · 1 preparing · 1 ready</span></div><span class="queue-status info">Live</span></div><div class="queue-item"><div class="queue-icon purple">${icon('receipt', 14)}</div><div><strong>ETB 18,460 outstanding</strong><span>Across 5 active stays</span></div><span class="queue-status pending">Review</span></div></div></section>
    </div>
    <section class="card table-card" style="margin-top:17px;"><div class="card-header"><div><div class="card-title">Active stays</div><div class="card-subtitle">Guests currently in house · balances update in real time</div></div><button class="card-link" data-view="stays">Manage stays ${icon('arrow-right', 11)}</button></div><table class="active-stays-table"><thead><tr><th>Guest</th><th>Room</th><th>Stay dates</th><th>Folio total</th><th>Balance</th><th></th></tr></thead><tbody>${stays.slice(0, 4).map((stay, i) => `<tr><td><div class="guest-cell"><div class="avatar ${['green','blue','yellow','purple'][i]}">${stay.initials}</div><div><strong>${esc(stay.guest)}</strong><span>${esc(stay.nationality)}</span></div></div></td><td><strong>${stay.room}</strong><br><span class="muted">${stay.type}</span></td><td>${stay.arrival.replace(', 2026','')} → ${stay.departure.replace(', 2026','')}</td><td>${fmt(charges(stay))}</td><td class="${balance(stay) > 0 ? 'balance-positive' : 'balance-clear'}">${fmt(balance(stay))}</td><td><button class="table-link" data-action="open-folio" data-id="${stay.id}">Open folio</button></td></tr>`).join('')}</tbody></table></section>`;
}

function roomCard(room) {
  return `<article class="room-card ${room.status}" data-action="open-room" data-room="${room.number}"><div class="room-top"><div><div class="room-number">${room.number}</div><div class="room-type">${room.type}</div></div><div class="room-rate">${fmt(room.rate)}<span> / night</span></div></div><div style="margin-top:11px;">${statusPill(roomStatusLabel(room.status))}</div><div class="room-details"><span class="room-detail"><span>${icon('bed', 12)}</span>${room.beds} ${room.beds === 1 ? 'bed' : 'beds'}</span><span class="room-detail"><span>${icon('users', 12)}</span>Up to ${room.max}</span></div>${room.guest ? `<div class="room-guest"><span class="mini-avatar">${room.initials}</span><strong>${esc(room.guest)}</strong></div>` : `<div class="room-guest empty"><span>—</span><em>No guest assigned</em></div>`}</article>`;
}
function renderRooms() {
  const statuses = ['all', 'available', 'occupied', 'reserved', 'cleaning', 'maintenance'];
  const filtered = state.roomFilter === 'all' ? rooms : rooms.filter(r => r.status === state.roomFilter);
  const floors = [...new Set(filtered.map(r => r.floor))];
  return `${pageHeader('Inventory · ' + rooms.length + ' rooms', 'Rooms & beds', 'A live map of accommodation status, guests and rate plans.', `${actionButton('Add room', 'add-room', 'plus', 'btn')} ${actionButton('Room settings', 'room-settings', 'sliders', 'btn-ghost')}`)}<div class="toolbar"><div class="filter-group">${statuses.map(s => `<button class="filter-chip ${state.roomFilter === s ? 'active' : ''}" data-room-filter="${s}">${s === 'all' ? 'All rooms' : roomStatusLabel(s)}${s === 'all' ? '' : ` <span class="muted">${rooms.filter(r => r.status === s).length}</span>`}</button>`).join('')}</div><div class="view-toggle"><button class="active" aria-label="Grid view">${icon('layout-grid', 14)}</button><button aria-label="List view">${icon('list', 14)}</button></div></div>${floors.map(floor => `<div class="floor-label">Floor ${floor}<span>${filtered.filter(r => r.floor === floor).length} rooms</span></div><div class="room-grid">${filtered.filter(r => r.floor === floor).map(roomCard).join('')}</div>`).join('')}`;
}

function renderReservations() {
  return `${pageHeader('Front desk · pipeline', 'Reservations', 'Manage the arrivals pipeline without losing sight of the live house.', `${actionButton('Check availability', 'check-availability', 'search', 'btn')} ${actionButton('New reservation', 'open-reservation', 'plus')}`)}<div class="section-tabs"><button class="active">All reservations <span class="muted">6</span></button><button>Arriving today <span class="muted">4</span></button><button>Pending confirmation <span class="muted">2</span></button><button>Cancelled</button></div><section class="card table-card"><div class="card-header"><div><div class="card-title">Reservation pipeline</div><div class="card-subtitle">Dates shown in property time · rates in ETB</div></div><button class="btn btn-small">${icon('download', 13)} Export</button></div><table class="data-table"><thead><tr><th>Reservation</th><th>Guest</th><th>Accommodation</th><th>Stay dates</th><th>Source</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>${reservations.map((r, i) => `<tr><td><strong>${r.id}</strong><br><span class="muted">${i < 2 ? 'Today' : 'Created Sep '+(14+i)}</span></td><td><div class="guest-cell"><div class="avatar ${['green','blue','yellow','purple'][i % 4]}">${r.initials}</div><div><strong>${esc(r.guest)}</strong><span>${r.source} · ${r.nights} nights</span></div></div></td><td><strong>${r.room}</strong><br><span class="muted">${r.roomType}</span></td><td>${r.dates}</td><td>${r.source}</td><td><strong>${fmt(r.amount)}</strong></td><td>${statusPill(r.status)}</td><td class="action-cell">${r.status === 'confirmed' ? `<button class="btn btn-small btn-teal" data-action="open-checkin" data-reservation="${r.id}">Check in</button>` : `<button class="icon-button subtle" aria-label="More actions">${icon('more-vertical', 15)}</button>`}</td></tr>`).join('')}</tbody></table></section>`;
}

function renderStays() {
  return `${pageHeader('In-house guests · live folios', 'Active stays', 'Every checked-in guest, their accommodation and current balance in one place.', `${actionButton('Add guest charge', 'open-charge', 'plus', 'btn')} ${actionButton('Take payment', 'open-payment', 'credit-card', 'btn')}`)}<div class="stats-grid"><div class="stat-card"><div class="stat-head"><span>In-house guests</span><span class="stat-icon teal">${icon('users', 15)}</span></div><div class="stat-value">${stays.length}<small> stays</small></div><div class="stat-foot"><span class="trend-up">+2</span><span>since yesterday</span></div></div><div class="stat-card"><div class="stat-head"><span>Outstanding balances</span><span class="stat-icon coral">${icon('receipt', 15)}</span></div><div class="stat-value">${fmt(stays.reduce((s, x) => s + balance(x), 0))}</div><div class="stat-foot"><span>5 active folios</span></div></div><div class="stat-card"><div class="stat-head"><span>Average stay</span><span class="stat-icon blue">${icon('calendar', 15)}</span></div><div class="stat-value">4.6<small> nights</small></div><div class="stat-foot"><span class="trend-up">+0.4 nights</span><span>vs. last month</span></div></div><div class="stat-card"><div class="stat-head"><span>Due to depart today</span><span class="stat-icon amber">${icon('log-out', 15)}</span></div><div class="stat-value">2</div><div class="stat-foot"><span class="trend-down">1 balance review</span></div></div></div><section class="card table-card"><div class="card-header"><div><div class="card-title">Guests in house</div><div class="card-subtitle">Select a stay to see the guest folio and take action</div></div><div class="global-search" style="width:190px"><span data-icon="search"></span><input placeholder="Filter active stays..." /></div></div><table class="data-table"><thead><tr><th>Guest</th><th>Room</th><th>Arrival</th><th>Departure</th><th>Charges</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>${stays.map((s, i) => `<tr><td><div class="guest-cell"><div class="avatar ${['green','blue','yellow','purple','green'][i]}">${s.initials}</div><div><strong>${esc(s.guest)}</strong><span>${s.nationality} · ${s.phone}</span></div></div></td><td><strong>${s.room}</strong><br><span class="muted">${s.type}</span></td><td>${s.arrival.replace(', 2026','')}</td><td>${s.departure.replace(', 2026','')}</td><td>${fmt(charges(s))}</td><td>${fmt(payments(s))}</td><td class="${balance(s) > 0 ? 'balance-positive' : 'balance-clear'}">${fmt(balance(s))}</td><td class="action-cell"><button class="table-link" data-action="open-folio" data-id="${s.id}">View folio ${icon('arrow-right', 11)}</button></td></tr>`).join('')}</tbody></table></section>`;
}

function typeDot(type) {
  return type === 'Food & Beverage' ? 'food' : type === 'Services' ? 'service' : type === 'Payment' ? 'payment' : '';
}
function renderFolio() {
  const stay = getStay();
  const room = rooms.find(r => r.number === stay.room);
  const roomCharges = stay.transactions.filter(t => t.type === 'Room' && t.amount > 0).reduce((s,t) => s+t.amount, 0);
  const foodCharges = stay.transactions.filter(t => t.type === 'Food & Beverage').reduce((s,t) => s+t.amount, 0);
  const serviceCharges = stay.transactions.filter(t => t.type === 'Services').reduce((s,t) => s+t.amount, 0);
  const paid = payments(stay);
  return `${pageHeader('Guest account · ' + esc(stay.room), 'Guest folio', 'A complete, traceable account for every charge, payment and adjustment during the stay.', `${actionButton('Add charge', 'open-charge', 'plus', 'btn')} ${actionButton('Take payment', 'open-payment', 'credit-card', 'btn')} ${actionButton('Checkout', 'open-checkout', 'log-out', 'btn-primary')}`)}<div class="folio-layout"><div><section class="folio-summary"><div class="eyebrow">Active stay · ${stay.id.replace('stay-','').toUpperCase()}</div><h2>${esc(stay.guest)}</h2><div class="folio-meta"><div><label>Room</label><strong>${stay.room} · ${stay.type}</strong></div><div><label>Stay</label><strong>${stay.arrival.replace(', 2026','')} → ${stay.departure.replace(', 2026','')}</strong></div><div><label>Nights</label><strong>${stay.nights} nights</strong></div><div class="folio-balance"><label>Current balance</label><strong>${fmt(balance(stay))}</strong></div></div></section><section class="card card-padding" style="margin-top:13px;"><div class="card-header"><div><div class="card-title">Financial activity</div><div class="card-subtitle">All transactions are immutable and source-linked</div></div><button class="btn btn-small" data-action="print-invoice">${icon('print', 13)} Print invoice</button></div><table class="folio-table"><thead><tr><th>Date</th><th>Description</th><th>Source</th><th>Amount</th></tr></thead><tbody>${stay.transactions.map(t => `<tr><td>${t.date}</td><td><strong>${esc(t.description)}</strong></td><td><span class="inline-icon-text"><i class="kind-dot ${typeDot(t.type)}"></i>${esc(t.type)}</span></td><td class="${t.amount < 0 ? 'balance-clear' : ''}">${t.amount < 0 ? '− ' : ''}${fmt(Math.abs(t.amount))}</td></tr>`).join('')}</tbody></table><div class="folio-totals"><div class="total-line"><span>Room charges</span><strong>${fmt(roomCharges)}</strong></div><div class="total-line"><span>Food & beverage</span><strong>${fmt(foodCharges)}</strong></div><div class="total-line"><span>Services & other</span><strong>${fmt(serviceCharges)}</strong></div><div class="total-line"><span>Taxes & fees</span><strong>${fmt(0)}</strong></div><div class="total-line"><span>Payments received</span><strong class="balance-clear">− ${fmt(paid)}</strong></div><div class="total-line grand"><span>Outstanding balance</span><strong>${fmt(balance(stay))}</strong></div></div></section></div><aside><section class="card profile-card"><div class="profile-head"><div class="profile-avatar">${stay.initials}</div><div><strong>${esc(stay.guest)}</strong><span>Primary guest · ${stay.nationality}</span></div><button class="icon-button subtle" style="margin-left:auto">${icon('more-vertical', 15)}</button></div><div class="profile-detail"><span>${icon('phone', 14)}</span><div><label>Phone</label><strong>${stay.phone}</strong></div></div><div class="profile-detail"><span>${icon('mail', 14)}</span><div><label>Email</label><strong>${stay.email}</strong></div></div><div class="profile-detail"><span>${icon('calendar', 14)}</span><div><label>Expected departure</label><strong>${stay.departure}</strong></div></div><div class="profile-detail"><span>${icon('bed', 14)}</span><div><label>Accommodation</label><strong>${room?.bedConfig || '1 king bed'} · ${fmt(stay.rate)} / night</strong></div></div><div class="modal-action-row"><button class="btn btn-small" data-action="extend-stay">${icon('calendar', 13)} Extend stay</button><button class="btn btn-small" data-action="change-room">${icon('door', 13)} Change room</button></div></section><section class="card card-padding" style="margin-top:13px;"><div class="card-header"><div><div class="card-title">Guest quick actions</div><div class="card-subtitle">Keep the folio moving</div></div></div><button class="btn btn-small" style="width:100%; margin-bottom:7px" data-action="open-charge">${icon('plus', 13)} Add service or charge</button><button class="btn btn-small" style="width:100%; margin-bottom:7px" data-action="open-payment">${icon('credit-card', 13)} Record payment</button><button class="btn btn-small" style="width:100%" data-action="open-checkout">${icon('log-out', 13)} Start checkout</button></section></aside></div>`;
}

function renderPOS() {
  const categories = ['All items', 'Breakfast', 'Mains', 'Drinks', 'Beverages'];
  const items = state.posCategory === 'All items' ? menuItems : menuItems.filter(x => x.category === state.posCategory);
  const total = state.cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  return `${pageHeader('Restaurant operations · till 01', 'Restaurant POS', 'One service flow for room charges and direct restaurant sales.', `${actionButton('Open order', 'clear-cart', 'plus', 'btn')} ${actionButton('Kitchen display', 'go-kitchen', 'chef-hat', 'btn-ghost')}`)}<div class="pos-layout"><section class="pos-menu"><div class="pos-categories">${categories.map(c => `<button class="${state.posCategory === c ? 'active' : ''}" data-pos-category="${c}">${c}</button>`).join('')}</div><div class="menu-grid">${items.map(item => `<button class="menu-item" data-action="pos-add" data-menu-id="${item.id}"><div class="menu-photo ${item.photo}">${item.emoji}</div><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small><div class="menu-item-price"><span>${fmt(item.price)}</span><i class="add-circle">${icon('plus', 13)}</i></div></button>`).join('')}</div></section><aside class="card card-padding order-panel"><div class="order-panel-head"><div><strong>New order</strong><span>Created by Marta Ayele · Till 01</span></div><span class="order-number">#1045</span></div><div class="order-context"><label>Order destination</label><div class="context-toggle"><button class="${state.posContext === 'room' ? 'active' : ''}" data-pos-context="room">${icon('door', 11)} Room charge</button><button class="${state.posContext === 'table' ? 'active' : ''}" data-pos-context="table">${icon('utensils', 11)} Table sale</button></div>${state.posContext === 'room' ? `<select id="pos-room" style="width:100%; margin-top:8px; border:1px solid #dbe6e2; background:white; border-radius:6px; padding:7px; color:#405756; font-size:10px"><option>Room 204 · John Doe</option><option>Room 301 · Lars Nilsson</option><option>Room 202 · Mulugeta & Co.</option></select>` : `<select id="pos-room" style="width:100%; margin-top:8px; border:1px solid #dbe6e2; background:white; border-radius:6px; padding:7px; color:#405756; font-size:10px"><option>Table 7 · 2 guests</option><option>Table 3 · 4 guests</option><option>Takeaway</option></select>`}</div><div class="order-items">${state.cart.length ? state.cart.map(line => `<div class="cart-item"><div class="avatar green" style="width:25px;height:25px;font-size:10px;border-radius:7px">${line.emoji}</div><div><strong>${esc(line.name)}</strong><span>${fmt(line.price)} each</span><div class="qty-control"><button data-action="cart-minus" data-menu-id="${line.id}">−</button><b>${line.qty}</b><button data-action="cart-plus" data-menu-id="${line.id}">+</button></div></div><div class="cart-price">${fmt(line.price * line.qty)}</div></div>`).join('') : `<div class="cart-empty"><div><span>${icon('utensils', 16)}</span><strong>Start an order</strong><br>Choose items from the menu</div></div>`}</div><div class="order-totals"><div class="total-line"><span>Subtotal</span><strong>${fmt(total)}</strong></div><div class="total-line"><span>Service charge <small class="muted">(0%)</small></span><strong>${fmt(0)}</strong></div><div class="order-total"><span>Total</span><strong>${fmt(total)}</strong></div></div><button class="btn btn-teal" data-action="send-order" ${state.cart.length ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>${icon('chef-hat', 14)} Send to kitchen · ${fmt(total)}</button><button class="btn btn-ghost btn-small" data-action="pos-direct-pay" ${state.cart.length ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>Pay now at till</button></aside></div>`;
}

function renderKitchen() {
  const columns = [
    { key: 'new', title: 'New', statuses: ['new'] },
    { key: 'accepted', title: 'Accepted', statuses: ['accepted'] },
    { key: 'preparing', title: 'Preparing', statuses: ['preparing'] },
    { key: 'ready', title: 'Ready', statuses: ['ready'] },
  ];
  const nextStatus = { new: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'served' };
  return `${pageHeader('Back of house · kitchen', 'Kitchen display', 'A focused preparation queue with only the information the kitchen needs.', `${actionButton('Restaurant POS', 'go-pos', 'utensils', 'btn')} ${actionButton('Refresh', 'refresh-kitchen', 'refresh-cw', 'btn-ghost')}`)}<div class="toolbar"><div class="filter-group"><span class="muted" style="font-size:10px">Service window</span><button class="filter-chip active">Breakfast · Live</button><button class="filter-chip">Lunch · 11:30</button><button class="filter-chip">Dinner · 17:30</button></div><div class="muted" style="font-size:10px">Last updated just now · Auto-refresh on</div></div><div class="kanban">${columns.map(col => { const list = kitchenOrders.filter(o => col.statuses.includes(o.status)); return `<section class="kanban-column"><div class="kanban-column-head"><strong>${col.title}</strong><span class="column-count">${list.length}</span></div>${list.map(order => `<article class="kitchen-order"><div class="kitchen-order-top"><strong>Order #${order.id}</strong><time>${order.time}</time></div><div class="order-location">${icon(order.location.startsWith('Room') ? 'door' : 'utensils', 11)} ${order.location} · ${order.guest}</div><div class="order-line">${order.items.map(item => `<div><b>${item.qty}×</b> ${esc(item.name)}</div>`).join('')}</div>${order.note ? `<div class="order-note">${esc(order.note)}</div>` : ''}${order.status !== 'served' ? `<button class="kanban-action" data-action="advance-order" data-order-id="${order.id}">${nextStatus[order.status] === 'served' ? 'Mark served' : `Move to ${nextStatus[order.status]}`}</button>` : ''}</article>`).join('') || '<div class="empty-state" style="padding:35px 5px"><span>'+icon('check',14)+'</span><strong>All clear</strong></div>'}</section>`; }).join('')}</div><section class="card card-padding" style="margin-top:17px"><div class="card-header"><div><div class="card-title">Recently served</div><div class="card-subtitle">Completed orders remain traceable</div></div><span class="status-pill ready">Live service</span></div><div class="arrival-list">${kitchenOrders.filter(o => o.status === 'served').map(o => `<div class="arrival-row"><div class="queue-icon blue">${icon('check-circle', 14)}</div><div><div class="row-primary">Order #${o.id} · ${o.location}</div><div class="row-secondary">${o.items.map(x => `${x.qty}× ${x.name}`).join(' · ')}</div></div><div class="arrival-meta"><div class="arrival-time">Served 08:14</div><div class="arrival-label">${o.guest}</div></div></div>`).join('')}</div></section>`;
}

function renderHousekeeping() {
  const counts = { all: housekeepingTasks.length, pending: housekeepingTasks.filter(x=>x.status==='pending').length, progress: housekeepingTasks.filter(x=>x.status==='in progress').length, completed: housekeepingTasks.filter(x=>x.status==='completed').length };
  return `${pageHeader('Rooms · service operations', 'Housekeeping', 'Turnovers, stayover service and inspections — coordinated with room status.', `${actionButton('New task', 'new-housekeeping', 'plus', 'btn')} ${actionButton('Team board', 'team-board', 'users', 'btn-ghost')}`)}<div class="stats-grid"><div class="stat-card"><div class="stat-head"><span>Open tasks</span><span class="stat-icon coral">${icon('sparkles', 15)}</span></div><div class="stat-value">${counts.pending + counts.progress}</div><div class="stat-foot"><span class="trend-down">3 high priority</span></div></div><div class="stat-card"><div class="stat-head"><span>In progress</span><span class="stat-icon amber">${icon('clock-3', 15)}</span></div><div class="stat-value">${counts.progress}</div><div class="stat-foot"><span>Avg. completion 24 min</span></div></div><div class="stat-card"><div class="stat-head"><span>Ready for inspection</span><span class="stat-icon blue">${icon('clipboard-check', 15)}</span></div><div class="stat-value">3</div><div class="stat-foot"><span>Rooms 101, 201, 304</span></div></div><div class="stat-card"><div class="stat-head"><span>Completed today</span><span class="stat-icon teal">${icon('check-circle', 15)}</span></div><div class="stat-value">${counts.completed + 9}</div><div class="stat-foot"><span class="trend-up">92% on time</span></div></div></div><div class="toolbar"><div class="filter-group"><button class="filter-chip active">All tasks · ${counts.all}</button><button class="filter-chip">Pending · ${counts.pending}</button><button class="filter-chip">In progress · ${counts.progress}</button><button class="filter-chip">Completed · ${counts.completed}</button></div><button class="btn btn-small">${icon('filter', 13)} Filters</button></div><div class="task-grid">${housekeepingTasks.map(task => `<article class="task-card"><div class="task-card-top"><div class="task-room"><strong>${task.room}</strong><span>Floor ${task.room[0]}</span></div><span class="priority ${task.priority}">${task.priority === 'high' ? 'High priority' : task.priority === 'normal' ? 'Normal' : 'Low priority'}</span></div><div class="task-name">${esc(task.type)}</div><div class="task-meta"><span>${esc(task.assignee)}</span><span>Created ${task.created}</span></div>${task.status === 'completed' ? `<div style="margin-top:13px">${statusPill('Completed')}</div>` : `<button class="btn btn-small ${task.status === 'in progress' ? 'btn-teal' : ''}" data-action="advance-housekeeping" data-task-id="${task.id}">${task.status === 'in progress' ? 'Mark complete' : 'Start task'} ${icon(task.status === 'in progress' ? 'check' : 'arrow-right', 12)}</button>`}</article>`).join('')}</div>`;
}

function renderMaintenance() {
  return `${pageHeader('Rooms · asset care', 'Maintenance', 'Keep rooms safe, sellable and ready. Every issue has an owner and a history.', `${actionButton('Report issue', 'new-maintenance', 'plus', 'btn')} ${actionButton('Export log', 'export-maintenance', 'download', 'btn-ghost')}`)}<div class="stats-grid"><div class="stat-card"><div class="stat-head"><span>Open issues</span><span class="stat-icon coral">${icon('alert-triangle', 15)}</span></div><div class="stat-value">3</div><div class="stat-foot"><span class="trend-down">1 high priority</span></div></div><div class="stat-card"><div class="stat-head"><span>Rooms offline</span><span class="stat-icon blue">${icon('door', 15)}</span></div><div class="stat-value">1</div><div class="stat-foot"><span>Room 302 · HVAC</span></div></div><div class="stat-card"><div class="stat-head"><span>Avg. resolution</span><span class="stat-icon amber">${icon('clock-3', 15)}</span></div><div class="stat-value">3.4<small> hrs</small></div><div class="stat-foot"><span class="trend-up">−18% this month</span></div></div><div class="stat-card"><div class="stat-head"><span>Resolved this month</span><span class="stat-icon teal">${icon('check-circle', 15)}</span></div><div class="stat-value">28</div><div class="stat-foot"><span>96% within SLA</span></div></div></div><section class="card table-card"><div class="card-header"><div><div class="card-title">Issue log</div><div class="card-subtitle">Room availability is blocked automatically for offline issues</div></div><div class="filter-group"><button class="filter-chip active">All</button><button class="filter-chip">Open</button><button class="filter-chip">In progress</button></div></div><table class="data-table"><thead><tr><th>Issue</th><th>Room</th><th>Category</th><th>Assigned to</th><th>Priority</th><th>Created</th><th>Status</th><th></th></tr></thead><tbody>${maintenanceIssues.map(x => `<tr><td><strong>${esc(x.issue)}</strong><br><span class="muted">${x.id}</span></td><td><strong>${x.room}</strong></td><td>${x.category}</td><td>${x.assignee}</td><td><span class="priority ${x.priority}">${x.priority}</span></td><td>${x.created}</td><td>${statusPill(x.status)}</td><td class="action-cell">${x.status !== 'resolved' ? `<button class="btn btn-small" data-action="resolve-maintenance" data-issue-id="${x.id}">${icon('check', 12)} Resolve</button>` : `<span class="muted">Closed</span>`}</td></tr>`).join('')}</tbody></table></section>`;
}

function renderReports() {
  return `${pageHeader('Management insight · September', 'Reports', 'A clear view of performance, revenue mix and the health of hotel operations.', `${actionButton('Export report', 'export-reports', 'download', 'btn')} ${actionButton('Date range', 'date-range', 'calendar', 'btn-ghost')}`)}<div class="report-kpis"><div class="report-kpi"><label>Total revenue · MTD</label><strong>${fmt(1246800)}</strong><span>${icon('trending-up', 11)} 14.8% vs. Aug</span></div><div class="report-kpi"><label>Room revenue</label><strong>${fmt(846200)}</strong><span>${icon('trending-up', 11)} 67.9% of total</span></div><div class="report-kpi"><label>Food & beverage</label><strong>${fmt(284600)}</strong><span>${icon('trending-up', 11)} 22.8% of total</span></div><div class="report-kpi"><label>Average daily rate</label><strong>${fmt(2780)}</strong><span>${icon('trending-up', 11)} 6.2% vs. Aug</span></div></div><div class="content-grid grid-main"><section class="card card-padding"><div class="card-header"><div><div class="card-title">Daily revenue</div><div class="card-subtitle">September 15 — September 21 · ETB</div></div><div class="chart-legend"><span><i class="legend-dot teal"></i>Total revenue</span></div></div><div class="report-bars"><div class="report-bar-col"><div class="report-bar-stack" style="--height:48"></div><span>15</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:65"></div><span>16</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:56"></div><span>17</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:76"></div><span>18</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:68"></div><span>19</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:84"></div><span>20</span></div><div class="report-bar-col"><div class="report-bar-stack" style="--height:100"></div><span>21</span></div></div></section><section class="card card-padding revenue-card"><div class="card-header"><div><div class="card-title">Revenue by department</div><div class="card-subtitle">Month to date</div></div><button class="card-link">Details ${icon('arrow-right', 11)}</button></div><div class="revenue-bars" style="margin-top:5px"><div><div class="revenue-bar-top"><span>Rooms</span><strong>67.9%</strong></div><div class="bar-track"><div class="bar-fill room" style="width:68%"></div></div></div><div><div class="revenue-bar-top"><span>Food & beverage</span><strong>22.8%</strong></div><div class="bar-track"><div class="bar-fill food" style="width:42%"></div></div></div><div><div class="revenue-bar-top"><span>Services</span><strong>6.4%</strong></div><div class="bar-track"><div class="bar-fill service" style="width:25%"></div></div></div><div><div class="revenue-bar-top"><span>Other</span><strong>2.9%</strong></div><div class="bar-track"><div class="bar-fill other" style="width:15%"></div></div></div></div></section></div><div class="content-grid grid-3" style="margin-top:17px"><section class="card card-padding"><div class="card-header"><div><div class="card-title">Occupancy</div><div class="card-subtitle">Month to date</div></div><span class="stat-icon teal">${icon('building-2', 15)}</span></div><div class="stat-value" style="font-size:31px">71.4<small>%</small></div><div class="stat-foot"><span class="trend-up">+5.4%</span><span>vs. last month</span></div></section><section class="card card-padding"><div class="card-header"><div><div class="card-title">Average length of stay</div><div class="card-subtitle">In-house guests</div></div><span class="stat-icon blue">${icon('calendar', 15)}</span></div><div class="stat-value" style="font-size:31px">3.8<small> nights</small></div><div class="stat-foot"><span class="trend-up">+0.6 nights</span><span>vs. last month</span></div></section><section class="card card-padding"><div class="card-header"><div><div class="card-title">Housekeeping SLA</div><div class="card-subtitle">Turnovers completed on time</div></div><span class="stat-icon amber">${icon('sparkles', 15)}</span></div><div class="stat-value" style="font-size:31px">92<small>%</small></div><div class="stat-foot"><span class="trend-up">+3.2%</span><span>vs. last month</span></div></section></div>`;
}

function renderSettings() {
  return `${pageHeader('Control plane · property setup', 'Settings', 'Configure the way Clove House operates. Changes are role-protected and audited.', `${actionButton('Save changes', 'save-settings', 'check', 'btn-primary')}`)}<div class="content-grid grid-main"><section class="card card-padding"><div class="card-header"><div><div class="card-title">Property settings</div><div class="card-subtitle">Business details shown on invoices and receipts</div></div><span class="stat-icon teal">${icon('building-2', 15)}</span></div><div class="form-grid"><div class="form-field"><label>Property name</label><input value="Clove House Addis" /></div><div class="form-field"><label>Property code</label><input value="CH-ADD-01" /></div><div class="form-field"><label>Base currency</label><select><option>ETB — Ethiopian Birr</option><option>USD — US Dollar</option><option>EUR — Euro</option></select></div><div class="form-field"><label>Timezone</label><select><option>Africa/Addis Ababa (EAT)</option></select></div><div class="form-field full"><label>Invoice address</label><textarea>Bole Road, Addis Ababa, Ethiopia</textarea></div></div></section><section class="card card-padding"><div class="card-header"><div><div class="card-title">Currencies & exchange rates</div><div class="card-subtitle">Rates are locked on each transaction</div></div><button class="btn btn-small">${icon('plus', 12)} Add currency</button></div><div class="arrival-list"><div class="arrival-row"><div class="avatar green">ET</div><div><div class="row-primary">ETB · Ethiopian Birr</div><div class="row-secondary">Base currency</div></div><div class="arrival-meta"><div class="arrival-time">1.00</div><div class="arrival-label">active</div></div></div><div class="arrival-row"><div class="avatar blue">$</div><div><div class="row-primary">USD · US Dollar</div><div class="row-secondary">Last updated today · 08:00</div></div><div class="arrival-meta"><div class="arrival-time">150.00 ETB</div><div class="arrival-label">per USD</div></div></div><div class="arrival-row"><div class="avatar purple">€</div><div><div class="row-primary">EUR · Euro</div><div class="row-secondary">Last updated today · 08:00</div></div><div class="arrival-meta"><div class="arrival-time">164.20 ETB</div><div class="arrival-label">per EUR</div></div></div></div></section></div><div class="content-grid grid-3" style="margin-top:17px"><section class="card card-padding"><div class="card-header"><div><div class="card-title">Taxes & fees</div><div class="card-subtitle">Applies to future charges</div></div><span class="stat-icon amber">${icon('receipt', 15)}</span></div><div class="total-line"><span>VAT · Room</span><strong>15%</strong></div><div class="total-line"><span>Service charge · F&B</span><strong>10%</strong></div><div class="total-line"><span>Tourism levy</span><strong>Off</strong></div><button class="btn btn-small" style="margin-top:15px">Manage rules ${icon('arrow-right', 12)}</button></section><section class="card card-padding"><div class="card-header"><div><div class="card-title">Roles & permissions</div><div class="card-subtitle">12 users · 8 roles</div></div><span class="stat-icon blue">${icon('shield', 15)}</span></div><div class="total-line"><span>Front desk</span><strong>4 users</strong></div><div class="total-line"><span>Restaurant</span><strong>6 users</strong></div><div class="total-line"><span>Administration</span><strong>2 users</strong></div><button class="btn btn-small" style="margin-top:15px">Manage access ${icon('arrow-right', 12)}</button></section><section class="card card-padding"><div class="card-header"><div><div class="card-title">Audit log</div><div class="card-subtitle">All changes are retained</div></div><span class="stat-icon teal">${icon('shield', 15)}</span></div><div class="total-line"><span>Last entry</span><strong>2 min ago</strong></div><div class="total-line"><span>Records this month</span><strong>1,482</strong></div><button class="btn btn-small" style="margin-top:15px">View audit log ${icon('arrow-right', 12)}</button></section></div>`;
}

function renderView() {
  switch (state.view) {
    case 'rooms': return renderRooms();
    case 'reservations': return renderReservations();
    case 'stays': return renderStays();
    case 'folio': return renderFolio();
    case 'pos': return renderPOS();
    case 'kitchen': return renderKitchen();
    case 'housekeeping': return renderHousekeeping();
    case 'maintenance': return renderMaintenance();
    case 'reports': return renderReports();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

const main = document.getElementById('main-content');
const modalRoot = document.getElementById('modal-root');
function render() {
  main.innerHTML = renderView();
  hydrateIcons(main);
  const navTitle = { dashboard:'Overview', rooms:'Rooms & beds', reservations:'Reservations', stays:'Active stays', folio:'Guest folios', pos:'Restaurant POS', kitchen:'Kitchen display', housekeeping:'Housekeeping', maintenance:'Maintenance', reports:'Reports', settings:'Settings' }[state.view] || 'Overview';
  document.getElementById('page-title').textContent = navTitle;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
}

function toast(message, kind = 'success') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(kind === 'success' ? 'check-circle' : 'alert-triangle', 15)}<span>${esc(message)}</span><button class="toast-close">${icon('x', 13)}</button>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4300);
}
function closeModal() { modalRoot.innerHTML = ''; }
function openModal(content, wide = false) { modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">${content}</div></div>`; hydrateIcons(modalRoot); }
function modalHeader(title, subtitle) { return `<div class="modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">${icon('x', 15)}</button></div>`; }
function modalFooter(cancel = 'Cancel', save = 'Save') { return `<div class="modal-footer"><button class="btn" data-action="close-modal">${cancel}</button><button class="btn btn-primary" type="submit">${save}</button></div>`; }

function checkinModal() {
  const available = rooms.filter(r => ['available', 'cleaning'].includes(r.status));
  openModal(`${modalHeader('Walk-in check-in', 'Create a guest profile, assign a room and open their folio in under a minute.')}<form data-form="checkin"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Guest full name</label><input name="guest" placeholder="e.g. John Doe" required autofocus /></div><div class="form-field"><label>Phone number</label><input name="phone" placeholder="+251 9..." /></div><div class="form-field"><label>Email address <span class="muted">(optional)</span></label><input name="email" type="email" placeholder="guest@email.com" /></div><div class="form-field"><label>Room / bed</label><select name="room">${available.map(r => `<option value="${r.number}">Room ${r.number} · ${r.type} · ${fmt(r.rate)}</option>`).join('')}</select></div><div class="form-field"><label>Rate per night</label><input name="rate" type="number" value="${available[0]?.rate || 1800}" min="0" required /></div><div class="form-field"><label>Arrival</label><input name="arrival" type="date" value="2026-09-21" /></div><div class="form-field"><label>Expected departure</label><input name="departure" type="date" value="2026-09-23" /></div><div class="form-field"><label>Deposit received</label><input name="deposit" type="number" value="0" min="0" /></div><div class="form-field"><label>Payment method</label><select name="method"><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Mobile payment</option></select></div><div class="form-field full"><label>Notes <span class="muted">(optional)</span></label><textarea name="notes" placeholder="Preferences, special requests or ID notes"></textarea></div></div></div>${modalFooter('Cancel', 'Complete check-in')}</form>`);
}
function reservationModal() {
  openModal(`${modalHeader('New reservation', 'Reserve accommodation for an in-house guest or a future arrival.')}<form data-form="reservation"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Guest full name</label><input name="guest" placeholder="e.g. Daniel Bekele" required autofocus /></div><div class="form-field"><label>Room type</label><select name="type"><option>Classic single</option><option>Classic twin</option><option>Deluxe king</option><option>Family suite</option><option>Executive suite</option></select></div><div class="form-field"><label>Room assignment <span class="muted">(optional)</span></label><select name="room"><option>Assign later</option>${rooms.filter(r=>r.status==='available').map(r=>`<option>Room ${r.number}</option>`).join('')}</select></div><div class="form-field"><label>Arrival date</label><input name="arrival" type="date" value="2026-09-22" required /></div><div class="form-field"><label>Departure date</label><input name="departure" type="date" value="2026-09-25" required /></div><div class="form-field"><label>Number of guests</label><input name="guests" type="number" value="1" min="1" /></div><div class="form-field"><label>Nightly rate</label><input name="rate" type="number" value="2200" min="0" /></div><div class="form-field"><label>Booking source</label><select name="source"><option>Direct</option><option>Phone</option><option>Email</option><option>Corporate</option><option>Walk-in</option></select></div><div class="form-field"><label>Deposit</label><input name="deposit" type="number" value="0" min="0" /></div><div class="form-field full"><label>Special requests</label><textarea name="notes" placeholder="Airport transfer, dietary needs, bed preference..."></textarea></div></div></div>${modalFooter('Cancel', 'Create reservation')}</form>`);
}
function paymentModal() {
  const stay = getStay();
  openModal(`${modalHeader('Record payment', `Add a traceable payment to ${esc(stay.guest)}'s active folio.`)}<form data-form="payment"><div class="modal-body"><div class="folio-summary" style="margin-bottom:18px"><div class="eyebrow">Current balance · Room ${stay.room}</div><h2>${fmt(balance(stay))}</h2><div class="folio-meta"><div><label>Guest</label><strong>${esc(stay.guest)}</strong></div><div><label>Folio</label><strong>${stay.id}</strong></div></div></div><div class="form-grid"><div class="form-field"><label>Amount</label><input name="amount" type="number" value="${balance(stay)}" min="1" required autofocus /></div><div class="form-field"><label>Currency</label><select name="currency"><option>ETB — Ethiopian Birr</option><option>USD — US Dollar</option><option>EUR — Euro</option></select></div><div class="form-field"><label>Payment method</label><select name="method"><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Mobile payment</option><option>Other</option></select></div><div class="form-field"><label>Reference number</label><input name="reference" placeholder="Receipt / transaction ID" /></div><div class="form-field full"><label>Payment note</label><textarea name="note" placeholder="Optional note for the audit trail"></textarea></div></div></div>${modalFooter('Cancel', 'Record payment')}</form>`);
}
function chargeModal() {
  const stay = getStay();
  openModal(`${modalHeader('Add guest charge', `Post a service, room adjustment or other charge to Room ${stay.room}.`)}<form data-form="charge"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Guest folio</label><select name="stay"><option value="${stay.id}">${esc(stay.guest)} · Room ${stay.room}</option>${stays.filter(s=>s.id!==stay.id).map(s=>`<option value="${s.id}">${esc(s.guest)} · Room ${s.room}</option>`).join('')}</select></div><div class="form-field"><label>Charge category</label><select name="type"><option>Services</option><option>Food & Beverage</option><option>Room</option><option>Other</option></select></div><div class="form-field"><label>Amount · ETB</label><input name="amount" type="number" value="450" min="1" required /></div><div class="form-field full"><label>Description</label><input name="description" value="Laundry · 4 items" required /></div><div class="form-field full"><label>Source reference <span class="muted">(optional)</span></label><input name="reference" placeholder="e.g. Laundry #205 or Room service #1045" /></div></div></div>${modalFooter('Cancel', 'Post charge')}</form>`);
}
function checkoutModal() {
  const stay = getStay();
  openModal(`${modalHeader('Review checkout', `Close the stay only after the folio is settled or authorized.`)}<div class="modal-body"><div class="folio-summary" style="margin-bottom:18px"><div class="eyebrow">Final folio · Room ${stay.room}</div><h2>${esc(stay.guest)}</h2><div class="folio-meta"><div><label>Total charges</label><strong>${fmt(charges(stay))}</strong></div><div><label>Payments</label><strong>${fmt(payments(stay))}</strong></div><div class="folio-balance"><label>Balance due</label><strong>${fmt(balance(stay))}</strong></div></div></div><div class="queue-item" style="border:1px solid #dbece5; border-radius:8px; padding:12px; background:#f4faf7"><div class="queue-icon teal">${icon('check-circle', 14)}</div><div><strong>Checkout will trigger housekeeping</strong><span>Room ${stay.room} will become dirty and a turnover task will be created.</span></div></div>${balance(stay) > 0 ? `<div class="form-help" style="margin-top:15px;color:#a65b53">A remaining balance of ${fmt(balance(stay))} must be collected before checkout, unless an authorized manager approves the exception.</div>` : ''}</div><div class="modal-footer"><button class="btn" data-action="close-modal">Cancel</button>${balance(stay)>0 ? `<button class="btn btn-teal" data-action="collect-and-checkout">Collect ${fmt(balance(stay))} & checkout</button>` : `<button class="btn btn-primary" data-action="complete-checkout">Complete checkout</button>`}</div>`);
}
function extendModal() {
  const stay = getStay();
  openModal(`${modalHeader('Extend stay', `Check availability before adding nights to ${esc(stay.guest)}'s account.`)}<form data-form="extend"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Guest and room</label><input value="${esc(stay.guest)} · Room ${stay.room}" disabled /></div><div class="form-field"><label>Current departure</label><input value="${stay.departure}" disabled /></div><div class="form-field"><label>New departure</label><input name="departure" type="date" value="2026-09-30" required /></div><div class="form-field"><label>Nightly rate</label><input name="rate" type="number" value="${stay.rate}" required /></div><div class="form-field"><label>Reason</label><select name="reason"><option>Guest request</option><option>Business extension</option><option>Operational change</option></select></div></div></div>${modalFooter('Cancel', 'Confirm extension')}</form>`);
}
function roomModal(roomNumber) {
  const room = rooms.find(r => r.number === roomNumber);
  const stay = room?.stayId ? getStay(room.stayId) : stays.find(s => s.room === roomNumber);
  openModal(`${modalHeader(`Room ${room.number}`, `${room.type} · Floor ${room.floor} · ${room.bedConfig}`)}<div class="modal-body"><div class="room-detail-modal"><div class="detail-hero"><div class="eyebrow">Live room status</div><h3>${room.number}</h3><p>${room.type} · Up to ${room.max} guests</p>${statusPill(roomStatusLabel(room.status))}<div class="modal-action-row"><button class="btn btn-small" style="background:white;border-color:white;color:#1b4e4a" data-action="open-room-folio" data-room="${room.number}">${icon('receipt', 12)} ${stay ? 'View folio' : 'Room history'}</button></div></div><div class="detail-list"><div class="detail-line"><span>Bed configuration</span><strong>${room.bedConfig}</strong></div><div class="detail-line"><span>Current rate</span><strong>${fmt(room.rate)} / night</strong></div><div class="detail-line"><span>Current guest</span><strong>${stay ? esc(stay.guest) : room.guest ? esc(room.guest) : 'No guest assigned'}</strong></div><div class="detail-line"><span>Expected checkout</span><strong>${stay ? stay.departure.replace(', 2026','') : room.checkOut || '—'}</strong></div><div class="detail-line"><span>Bed model</span><strong>Room-based · 1 room / account</strong></div></div></div><div class="modal-action-row">${stay ? `<button class="btn btn-teal" data-action="open-charge">${icon('plus', 13)} Add charge</button><button class="btn" data-action="open-payment">${icon('credit-card', 13)} Add payment</button><button class="btn" data-action="extend-stay">${icon('calendar', 13)} Extend stay</button>` : `<button class="btn btn-teal" data-action="open-checkin">${icon('user-plus', 13)} Check in guest</button><button class="btn" data-action="block-room">${icon('wrench', 13)} Block room</button>`}</div></div>`);
}

function addTransaction(stay, tx) { stay.transactions.push({ id: 'tx-' + Date.now(), date: 'Sep 21', ...tx }); }

// Navigation and delegated interactions

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) {
    state.view = nav.dataset.view;
    render();
    document.getElementById('main-content').focus({ preventScroll: true });
    document.getElementById('sidebar').classList.remove('open');
    return;
  }
  const roomFilter = event.target.closest('[data-room-filter]');
  if (roomFilter) { state.roomFilter = roomFilter.dataset.roomFilter; render(); return; }
  const posCat = event.target.closest('[data-pos-category]');
  if (posCat) { state.posCategory = posCat.dataset.posCategory; render(); return; }
  const posContext = event.target.closest('[data-pos-context]');
  if (posContext) { state.posContext = posContext.dataset.posContext; render(); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const a = action.dataset.action;
  if (a === 'close-modal') { if (event.target.classList.contains('modal-backdrop') || action.classList.contains('modal-close') || action.classList.contains('btn')) closeModal(); return; }
  if (a === 'open-checkin') { checkinModal(); return; }
  if (a === 'open-reservation') { reservationModal(); return; }
  if (a === 'open-payment') { paymentModal(); return; }
  if (a === 'open-charge') { chargeModal(); return; }
  if (a === 'open-checkout') { checkoutModal(); return; }
  if (a === 'extend-stay') { extendModal(); return; }
  if (a === 'open-room') { const room = rooms.find(r => r.number === action.dataset.room); const linkedStay = room?.stayId ? getStay(room.stayId) : stays.find(s => s.room === action.dataset.room); if (linkedStay) state.selectedStayId = linkedStay.id; roomModal(action.dataset.room); return; }
  if (a === 'open-room-folio') { const room = rooms.find(r => r.number === action.dataset.room); const stay = stays.find(s=>s.room===room.number); if(stay){ state.selectedStayId=stay.id; state.view='folio'; closeModal(); render(); } else toast('No active folio is linked to this room.'); return; }
  if (a === 'open-folio') { state.selectedStayId = action.dataset.id; state.view = 'folio'; render(); return; }
  if (a === 'go-kitchen') { state.view = 'kitchen'; render(); return; }
  if (a === 'go-pos') { state.view = 'pos'; render(); return; }
  if (a === 'refresh-kitchen') { toast('Kitchen queue is up to date.'); return; }
  if (a === 'clear-cart') { state.cart = []; render(); toast('New order started.'); return; }
  if (a === 'pos-add') { const item = menuItems.find(x => x.id === action.dataset.menuId); const line = state.cart.find(x=>x.id===item.id); if(line) line.qty += 1; else state.cart.push({...item, qty:1}); render(); return; }
  if (a === 'cart-plus' || a === 'cart-minus') { const line = state.cart.find(x=>x.id===action.dataset.menuId); if(line){ line.qty += a==='cart-plus' ? 1 : -1; if(line.qty<=0) state.cart=state.cart.filter(x=>x.id!==line.id); } render(); return; }
  if (a === 'send-order' || a === 'pos-direct-pay') {
    if(!state.cart.length) return;
    const total = state.cart.reduce((s,x)=>s+x.price*x.qty,0);
    if (a === 'send-order' && state.posContext === 'room') {
      const stay = getStay('stay-john');
      addTransaction(stay, { type:'Food & Beverage', description: `${state.cart.map(x=>`${x.name} × ${x.qty}`).join(', ')} · Order #1045`, amount: total });
      kitchenOrders.unshift({ id:'1045', location:'Room 204', guest:'John Doe', time:'09:14', status:'new', priority:'Standard', items:state.cart.map(x=>({name:x.name,qty:x.qty})), note:'Charge to room · sent from POS' });
      state.cart=[]; toast(`Order #1045 sent to kitchen and added to John Doe's folio.`); render();
    } else if (a === 'send-order') { kitchenOrders.unshift({ id:'1045', location:'Table 7', guest:'Walk-in guest', time:'09:14', status:'new', priority:'Standard', items:state.cart.map(x=>({name:x.name,qty:x.qty})) }); state.cart=[]; toast('Order #1045 sent to kitchen for table service.'); render(); }
    else { state.cart=[]; toast(`Direct payment of ${fmt(total)} recorded at till 01.`); render(); }
    return;
  }
  if (a === 'advance-order') { const order = kitchenOrders.find(o=>o.id===action.dataset.orderId); const next={new:'accepted',accepted:'preparing',preparing:'ready',ready:'served'}; if(order){ order.status=next[order.status]; toast(`Order #${order.id} moved to ${order.status}.`); render(); } return; }
  if (a === 'advance-housekeeping') { const task=housekeepingTasks.find(x=>x.id===action.dataset.taskId); if(task){ if(task.status==='pending') task.status='in progress'; else task.status='completed'; const room=rooms.find(r=>r.number===task.room); if(room && task.status==='completed') room.status='available'; toast(`Room ${task.room} task marked ${task.status}.`); render(); } return; }
  if (a === 'resolve-maintenance') { const issue=maintenanceIssues.find(x=>x.id===action.dataset.issueId); if(issue){ issue.status='resolved'; const room=rooms.find(r=>r.number===issue.room); if(room) room.status='available'; toast(`${issue.id} resolved and Room ${issue.room} is available.`); render(); } return; }
  if (a === 'collect-and-checkout') { closeModal(); paymentModal(); return; }
  if (a === 'complete-checkout') { const stay=getStay(); const room=rooms.find(r=>r.number===stay.room); if(room) { room.status='dirty'; room.guest=undefined; } const taskId='hk-'+Date.now(); housekeepingTasks.unshift({id:taskId,room:stay.room,type:'Turnover clean · checkout',assignee:'Unassigned',priority:'high',status:'pending',created:'09:16'}); toast(`Checkout complete. Room ${stay.room} is dirty and housekeeping was notified.`); closeModal(); state.view='housekeeping'; render(); return; }
  if (a === 'change-room') { toast('Room change workflow opened — availability and folio history will be preserved.'); return; }
  if (a === 'add-room' || a === 'room-settings' || a === 'block-room' || a === 'check-availability' || a === 'new-housekeeping' || a === 'team-board' || a === 'new-maintenance' || a === 'export-maintenance' || a === 'export-reports' || a === 'date-range' || a === 'save-settings' || a === 'print-invoice') { toast({ 'add-room':'Room setup opened for your administrator.', 'room-settings':'Room configuration is role-protected.', 'block-room':'Room block workflow opened.', 'check-availability':'Availability search is ready for your dates.', 'new-housekeeping':'New housekeeping task form opened.', 'team-board':'Team board is synced.', 'new-maintenance':'Maintenance report form opened.', 'export-maintenance':'Maintenance log export prepared.', 'export-reports':'Management report export prepared.', 'date-range':'Date range selector opened.', 'save-settings':'Settings saved and added to the audit log.', 'print-invoice':'Invoice sent to the print queue.' }[a] || 'Action completed.'); return; }
  if (a === 'toast-close') action.closest('.toast')?.remove();
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  if (form.dataset.form === 'checkin') {
    const room = rooms.find(r=>r.number===data.room); const id='stay-'+Date.now(); const nights=Math.max(1, Math.round((new Date(data.departure)-new Date(data.arrival))/86400000)); const guest=String(data.guest); const tx=[{id:'tx-'+Date.now(),date:'Sep 21',type:'Room',description:'Room charge · Night 1',amount:Number(data.rate||0)}]; if(Number(data.deposit)>0) tx.push({id:'tx-'+(Date.now()+1),date:'Sep 21',type:'Payment',description:`Deposit · ${data.method}`,amount:-Number(data.deposit),method:data.method}); const stay={id,guest,initials:initials(guest),room:data.room,type:room?.type||'Room',arrival:'Sep 21, 2026',departure:'Sep 23, 2026',nights,phone:data.phone||'—',email:data.email||'—',nationality:'Not specified',rate:Number(data.rate||0),transactions:tx}; stays.unshift(stay); if(room){room.status='occupied';room.guest=guest;room.initials=stay.initials;room.checkIn='Sep 21';room.checkOut='Sep 23';room.stayId=id;} state.selectedStayId=id; closeModal(); state.view='folio'; render(); toast(`${guest} checked in to Room ${data.room}.`); return;
  }
  if (form.dataset.form === 'reservation') { const guest=String(data.guest); reservations.unshift({id:'RES-'+Math.floor(2400+Math.random()*600),guest,initials:initials(guest),room:data.room==='Assign later'?'—':data.room.replace('Room ',''),roomType:data.type,dates:'Sep 22 → Sep 25',nights:3,source:data.source,status:'confirmed',amount:Number(data.rate||0)*3}); closeModal(); state.view='reservations'; render(); toast(`Reservation created for ${guest}.`); return; }
  if (form.dataset.form === 'payment') { const stay=getStay(); addTransaction(stay,{type:'Payment',description:`Payment · ${data.method}${data.reference ? ` · ${data.reference}` : ''}`,amount:-Number(data.amount),method:data.method}); closeModal(); state.view='folio'; render(); toast(`${fmt(Number(data.amount))} payment recorded for ${stay.guest}.`); return; }
  if (form.dataset.form === 'charge') { const stay=getStay(data.stay); addTransaction(stay,{type:data.type,description:data.description+(data.reference?` · ${data.reference}`:''),amount:Number(data.amount)}); state.selectedStayId=stay.id; closeModal(); state.view='folio'; render(); toast(`${fmt(Number(data.amount))} charge added to ${stay.guest}'s folio.`); return; }
  if (form.dataset.form === 'extend') { const stay=getStay(); stay.departure='Sep 30, 2026'; stay.nights += 2; addTransaction(stay,{type:'Room',description:'Room charge · Extended stay · 2 nights',amount:Number(data.rate)*2}); const room=rooms.find(r=>r.number===stay.room); if(room) room.checkOut='Sep 30'; closeModal(); state.view='folio'; render(); toast(`Stay extended through September 30. Two room nights added.`); return; }
});

document.getElementById('mobile-menu').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('global-search').addEventListener('keydown', event => { if(event.key === 'Enter'){ const q=event.target.value.trim().toLowerCase(); const stay=stays.find(s=>s.guest.toLowerCase().includes(q)||s.room.includes(q)); const room=rooms.find(r=>r.number===q); if(stay){state.selectedStayId=stay.id;state.view='folio';render();toast(`Showing folio for ${stay.guest}.`);} else if(room){state.view='rooms';state.roomFilter=room.status;render();toast(`Showing Room ${room.number} · ${roomStatusLabel(room.status)}.`);} else toast('No matching guest, room or folio found.'); }});

hydrateIcons();
render();
