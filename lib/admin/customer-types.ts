/**
 * Customer type configuration for Khách Hàng panel.
 * Maps cust_class_key from the door table to display info and icons.
 */

export interface CustomerTypeConfig {
  label: string
  color: string       // hex color for map pins and icons
  bgClass: string     // Tailwind bg class for badge
  textClass: string   // Tailwind text class
  svgPath: string     // SVG path(s) for the icon symbol
}

// SVG paths use a 24x24 viewBox
const ICONS = {
  // Vet store — stethoscope-like cross
  vetStore: 'M12 2C9.24 2 7 4.24 7 7v1H5v2h2v8c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-8h2V8h-2V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v1H9V7c0-1.66 1.34-3 3-3zm-1 7h2v4h-2v-4zm-3 0h2v2H8v-2zm7 0h1v2h-1v-2z',
  // Company / building
  company: 'M4 2h16v2H4V2zm0 4h3v2H4V6zm5 0h3v2H9V6zm5 0h3v2h-3V6zM4 12h3v2H4v-2zm5 0h3v2H9v-2zm5 0h3v2h-3v-2zM4 18h3v2H4v-2zm5 0h3v2H9v-2zm5 0h3v2h-3v-2zM2 22h20v-2H2v2z',
  // Walk-in person
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  // Farm / barn
  farm: 'M22 9V7l-2-2.5V3H4v1.5L2 7v2h1v11h18V9h1zM11 18H6v-5h5v5zm7 0h-5v-5h5v5zM4 9h16v1H4V9z',
  // Agent / store front
  store: 'M20 4H4v2l8 5 8-5V4zM4 13h16v7H4v-7z',
  // Fish / aquaculture
  fish: 'M12 2C8 2 5 5 4 9H2v2h2c.55 3.94 3.5 7 7 8V22h2v-3.08C16.5 18 19.45 14.94 20 11h2V9h-2C19 5 16 2 12 2zm0 2c3 0 5.5 2.7 6 6H6c.5-3.3 3-6 6-6zm-1 8h2v2h-2v-2zm-3-1h2v2H8v-2zm7-1h2v2h-2v-2z',
  // Pig farm
  pigFarm: 'M18 4H6L4 8v2h1v10h14V10h1V8l-2-4zm-4 12h-4v-2h4v2zm2-4H8v-2h8v2zm0-4H8V7h8v1z',
  // Chicken farm
  chicken: 'M11 3C8.24 3 6 5.24 6 8s2.24 5 5 5h2c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm8 4H5v1c0 3.31 2.69 6 6 6h2c3.31 0 6-2.69 6-6v-1z',
  // Feed / food
  feed: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
  // Shrimp / seafood
  shrimp: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
  // Generic/other
  other: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
}

export const CUSTOMER_TYPE_CONFIG: Record<string, CustomerTypeConfig> = {
  DLTY: {
    label: 'Đại lý thú y',
    color: '#10b981',   // emerald
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-400',
    svgPath: ICONS.vetStore,
  },
  CTY: {
    label: 'Công ty',
    color: '#3b82f6',   // blue
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-400',
    svgPath: ICONS.company,
  },
  TC: {
    label: 'KH vãng lai',
    color: '#9ca3af',   // gray
    bgClass: 'bg-gray-600',
    textClass: 'text-gray-400',
    svgPath: ICONS.person,
  },
  Other: {
    label: 'Khác',
    color: '#6b7280',   // gray-500
    bgClass: 'bg-gray-500',
    textClass: 'text-gray-400',
    svgPath: ICONS.other,
  },
  OTHER: {
    label: 'Khác',
    color: '#6b7280',
    bgClass: 'bg-gray-500',
    textClass: 'text-gray-400',
    svgPath: ICONS.other,
  },
  TB: {
    label: 'Trại',
    color: '#f59e0b',   // amber
    bgClass: 'bg-amber-600',
    textClass: 'text-amber-400',
    svgPath: ICONS.farm,
  },
  DL: {
    label: 'Đại lý',
    color: '#8b5cf6',   // violet
    bgClass: 'bg-violet-600',
    textClass: 'text-violet-400',
    svgPath: ICONS.store,
  },
  DLTS: {
    label: 'Đại lý thủy sản',
    color: '#06b6d4',   // cyan
    bgClass: 'bg-cyan-600',
    textClass: 'text-cyan-400',
    svgPath: ICONS.fish,
  },
  TRH: {
    label: 'Trại heo',
    color: '#ec4899',   // pink
    bgClass: 'bg-pink-600',
    textClass: 'text-pink-400',
    svgPath: ICONS.pigFarm,
  },
  TG: {
    label: 'Trại gà',
    color: '#84cc16',   // lime
    bgClass: 'bg-lime-600',
    textClass: 'text-lime-400',
    svgPath: ICONS.chicken,
  },
  MGFEED: {
    label: 'Mgfeed',
    color: '#d97706',   // amber-600
    bgClass: 'bg-amber-700',
    textClass: 'text-amber-400',
    svgPath: ICONS.feed,
  },
  STA: {
    label: 'Nhân viên',
    color: '#ef4444',   // red
    bgClass: 'bg-red-600',
    textClass: 'text-red-400',
    svgPath: ICONS.person,
  },
  TT: {
    label: 'Trại tôm',
    color: '#14b8a6',   // teal
    bgClass: 'bg-teal-600',
    textClass: 'text-teal-400',
    svgPath: ICONS.shrimp,
  },
}

export function getCustomerTypeConfig(typeCode: string): CustomerTypeConfig {
  return CUSTOMER_TYPE_CONFIG[typeCode] ?? {
    label: typeCode,
    color: '#6b7280',
    bgClass: 'bg-gray-500',
    textClass: 'text-gray-400',
    svgPath: ICONS.other,
  }
}

/** Generate an SVG icon element string for use in Leaflet divIcon */
export function getCustomerTypeSvgHtml(typeCode: string, size = 28): string {
  const cfg = getCustomerTypeConfig(typeCode)
  return `
    <div style="
      width: ${size}px; height: ${size}px;
      background: ${cfg.color};
      border: 2px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size * 0.55}" height="${size * 0.55}" fill="white">
          <path d="${cfg.svgPath}"/>
        </svg>
      </div>
    </div>
  `
}
