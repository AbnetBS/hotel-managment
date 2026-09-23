const paths = {
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  door: '<path d="M5 20h14M7 20V4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V20M7 7h10M14 12h.01"/>',
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M6 10V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3M3 20v-2M21 20v-2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4M17 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01"/>',
  users: '<path d="M16 20v-1.7a3.3 3.3 0 0 0-3.3-3.3H6.3A3.3 3.3 0 0 0 3 18.3V20M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1.5a3.3 3.3 0 0 0-2.5-3.2M16.5 3.1a4 4 0 0 1 0 7.8"/>',
  receipt: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  utensils: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c3 2 3 6 0 8"/>',
  'chef-hat': '<path d="M6 10.5a4 4 0 1 1 2.5-7.1A4.8 4.8 0 0 1 17 5.8a3.8 3.8 0 1 1 1 7.6H6Z"/><path d="M5 14v5h14v-5M8 19v2M16 19v2"/>',
  sparkles: '<path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3ZM19 14l-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14Z"/>',
  wrench: '<path d="m14.7 6.3 3-3a5 5 0 0 0-6.4 6.4l-7.5 7.5a2 2 0 1 0 2.8 2.8l7.5-7.5a5 5 0 0 0 6.4-6.4l-3 3-2.8.2-.2-2.8Z"/>',
  chart: '<path d="M4 19V5M4 19h17M8 16v-5M12 16V7M16 16v-3M20 16V4"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  phone: '<path d="M21 16.7v2.1a2 2 0 0 1-2.2 2 19 19 0 0 1-8.3-3 18.6 18.6 0 0 1-5.7-5.7 19 19 0 0 1-3-8.4A2 2 0 0 1 3.8 1.5h2.1a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.2 9.2a16 16 0 0 0 7.6 7.6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  'credit-card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  banknote: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h.01M18 15h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'log-out': '<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/>',
  pencil: '<path d="m4 16-.8 4.8L8 20l11.4-11.4a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16ZM14 6l4 4"/>',
  upload: '<path d="M12 20V8M8 12l4-4 4 4M5 4h14"/>',
  coffee: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 4c0 .8.6 1 .6 2M11 4c0 .8.6 1 .6 2"/>',
  cup: '<path d="M6 7h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7ZM9 3l1 4M15 3l-1 4"/>',
  glass: '<path d="M5 4h14l-5 8v6h3M10 18h3M9 12 5 4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M17 4l3 3-2 2-2-2"/>',
  wifi: '<path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M12 18h.01"/>',
  building: '<path d="M3 21h18M5 21V5l7-3 7 3v16M9 21v-5h6v5M8 8h1M15 8h1M8 12h1M15 12h1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  'user-plus': '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>',
  'trending-up': '<path d="m3 17 6-6 4 4 7-8M15 7h5v5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 18v3"/>',
  clipboard: '<path d="M9 5h6M9 4a3 3 0 0 1 6 0M7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="m8 14 2.5 2.5L16 11"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  'chevron-left': '<path d="m14 6-6 6 6 6"/>',
  'chevron-right': '<path d="m10 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'more': '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  'alert': '<path d="m10.3 3.6-8 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  'lock': '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'send': '<path d="M22 3 11 14M22 3l-7 18-4-7-7-4 18-7Z"/>',
  'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'moon': '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  'hot': '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.8 1.4-4M12 21a6 6 0 0 0 6-6"/>',
  'play': '<path d="M7 4.5 19 12 7 19.5Z"/>',
  'filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
  'key-2': '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/>',
};

export function Icon({ name, size = 16, className = '', strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <g dangerouslySetInnerHTML={{ __html: paths[name] || paths.grid }} />
    </svg>
  );
}

export const ROLE_ICON = {
  admin: 'shield',
  manager: 'chart',
  cashier: 'banknote',
  waiter: 'users',
  kitchen: 'chef-hat',
  barista: 'coffee',
  juice: 'cup',
  housekeeping: 'sparkles',
  maintenance: 'wrench',
};
