import type { CSSProperties } from 'react';

type IconRenderer = (s: number) => string;

const ICONS: Record<string, IconRenderer> = {
  // Tab bar
  home: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/></svg>`,
  home_fill: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 10.8L12 4l8.6 6.8c.3.2.4.6.4.9V20a2 2 0 01-2 2h-3.5v-6.5a1 1 0 00-1-1h-5a1 1 0 00-1 1V22H5a2 2 0 01-2-2v-8.3c0-.3.1-.7.4-.9z"/></svg>`,
  calendar: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  calendar_fill: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-2V3a1 1 0 10-2 0v1H9V3a1 1 0 00-2 0v1H5a2 2 0 00-2 2v3h18V6a2 2 0 00-2-2zM3 11v8a2 2 0 002 2h14a2 2 0 002-2v-8H3zm6 7H7v-2h2v2zm0-4H7v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>`,
  map_pin: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  map_pin_fill: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a8 8 0 00-8 8c0 5.4 6.5 11.6 7.4 12.5a1 1 0 001.3 0c.9-.9 7.3-7.1 7.3-12.5a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>`,
  groups: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-3-3.87"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  groups_fill: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="4"/><path d="M9 13c-3.3 0-6 1.8-6 4v2c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-2c0-2.2-2.7-4-6-4z"/><circle cx="17" cy="8" r="3"/><path d="M22 18v-1.3c0-1.7-2.2-3-5-3a8 8 0 00-2 .2c1.4.9 2 2.1 2 3.1v2h4c.6 0 1-.4 1-1z"/></svg>`,
  user: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  user_fill: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4.5"/><path d="M12 13.5c-4.2 0-8 2.2-8 5.3V21c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-2.2c0-3.1-3.8-5.3-8-5.3z"/></svg>`,

  // UI
  search: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`,
  bell: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></svg>`,
  plus: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  filter: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`,
  sliders: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="14" y2="6"/><line x1="18" y1="6" x2="20" y2="6"/><circle cx="16" cy="6" r="2"/><line x1="4" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="20" y2="12"/><circle cx="8" cy="12" r="2"/><line x1="4" y1="18" x2="14" y2="18"/><line x1="18" y1="18" x2="20" y2="18"/><circle cx="16" cy="18" r="2"/></svg>`,
  clock: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  location: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  directions: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
  back: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
  forward: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  more: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  close: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  check: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  chevron: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  star: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7.5.7-5.7 5L18.5 22 12 18l-6.5 4 1.7-7.3-5.7-5L9 9z"/></svg>`,
  bolt: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2L4 14h7l-1 8 10-12h-7l1-8z"/></svg>`,
  paddle: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="11" cy="9" rx="7" ry="8"/><path d="M9 16l-4 5a2 2 0 002.8 2.8L13 19" fill="currentColor" opacity="0.6"/></svg>`,
  mic: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v1a7 7 0 01-14 0v-1M12 18v3"/></svg>`,
  message: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  share: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  heart: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8L12 21.4l8.8-8.9a5.5 5.5 0 000-7.8z"/></svg>`,
  heart_o: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8L12 21.4l8.8-8.9a5.5 5.5 0 000-7.8z"/></svg>`,
  eye: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eye_off: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0112 20c-7 0-11-8-11-8a18.4 18.4 0 015.1-5.9m3.3-1.6A10.5 10.5 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.2 3.2m-6.7-1.1a3 3 0 01-4.2-4.2"/><path d="M1 1l22 22"/></svg>`,
  trophy: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h10v2h3a1 1 0 011 1v2a4 4 0 01-4 4h-.3a5 5 0 01-3.7 3.9V19h3a1 1 0 010 2H8a1 1 0 010-2h3v-2.1A5 5 0 017.3 13H7a4 4 0 01-4-4V7a1 1 0 011-1h3V4zm0 4H5v1a2 2 0 002 2V8zm10 0v3a2 2 0 002-2V8h-2z"/></svg>`,
  send: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  fire: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s4 4 4 9-2 6-4 6c-2 0-4-1-4-6 0-3 2-5 2-7 0 1 1 2 2 2z"/><path d="M8 13c0 4 2 7 4 7s4-3 4-7c0-2-1-3-2-4 0 4-3 6-3 6s-1-1-1-3c-1 0-2 1-2 1z" opacity="0.6"/></svg>`,
  shield: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  settings: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  logout: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  help: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
  add_circle: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  navigate: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
  layers: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  cup: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2h2a2 2 0 012 2v3a3 3 0 01-3 3h-1.2a6 6 0 01-4.8 4.6V20h3a1 1 0 010 2H7a1 1 0 010-2h3v-2.4A6 6 0 015.2 13H4a3 3 0 01-3-3V7a2 2 0 012-2h2V3z"/></svg>`,
  music: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  verified: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.5 3.5 4.3-1L19 8l3 2-2.5 3.5L21 17l-4-1-1 4-4-2-4 2-1-4-4 1 1.5-3.5L3 10l3-2 .2-4.5 4.3 1L12 1z"/><path d="M9.5 12.5l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  spinner: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="40 20" stroke-linecap="round"/></svg>`,
  camera: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  mail: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>`,
  globe: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>`,
  lock: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`,
  edit: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  wifi_off: (s) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22M16.7 17.7a5 5 0 00-9.4 0M5 12.5a10 10 0 0114 0M2 8.8A14 14 0 015.5 6.3M22 8.8a14 14 0 00-5-3M12 20h.01"/></svg>`,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Icon({ name, size = 20, className = '', style, onClick }: IconProps) {
  const fn = ICONS[name];
  const baseStyle: CSSProperties = { width: size, height: size, ...style };

  if (!fn) {
    return (
      <span
        className={`material-symbols-outlined inline-flex items-center justify-center leading-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ ...baseStyle, fontSize: size }}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        {name}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center leading-[0] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={baseStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      dangerouslySetInnerHTML={{ __html: fn(size) }}
    />
  );
}
