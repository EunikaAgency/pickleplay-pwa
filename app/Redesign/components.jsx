// Shared UI components for PickleBallers app

const { useState, useEffect, useRef, useCallback } = React;

// ─── Avatar ────────────────────────────────────────────────
function Avatar({ name, src, size = 40, variant = 'blue', className = '', style }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '';
  return (
    <span
      className={`avatar ${variant} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, ...style }}
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

// ─── Tab bar ───────────────────────────────────────────────
function TabBar({ active, onChange, onCreate }) {
  const tabs = [
    { id: 'home',  label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
    { id: 'games', label: 'Games',  icon: 'calendar', iconFill: 'calendar_fill' },
    { id: 'fab',   label: '',       icon: 'plus',     isFab: true },
    { id: 'map',   label: 'Courts', icon: 'map_pin',  iconFill: 'map_pin_fill' },
    { id: 'profile', label: 'You',  icon: 'user',     iconFill: 'user_fill' },
  ];
  return (
    <div className="tabbar">
      {tabs.map(t => {
        if (t.isFab) {
          return (
            <button key="fab" className="fab" onClick={onCreate} aria-label="Create game">
              <Icon name="plus" size={22} />
            </button>
          );
        }
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <Icon name={isActive ? t.iconFill : t.icon} size={22} />
            <span className="label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Bottom Sheet ──────────────────────────────────────────
function Sheet({ open, onClose, title, children, height }) {
  return (
    <React.Fragment>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`} style={height ? { height } : null}>
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="close" onClick={onClose} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </React.Fragment>
  );
}

// ─── Segmented control ─────────────────────────────────────
function Segmented({ options, value, onChange }) {
  const idx = options.findIndex(o => o.value === value);
  const w = `calc((100% - 6px) / ${options.length})`;
  return (
    <div className="seg">
      <div
        className="indicator"
        style={{ width: w, transform: `translateX(calc(${idx} * (100% + 0px)))` }}
      />
      {options.map(o => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Toast (lives at the root) ─────────────────────────────
function Toast({ message, show }) {
  return (
    <div className={`toast ${show ? 'show' : ''}`}>
      <span className="check"><Icon name="check" size={16} /></span>
      {message}
    </div>
  );
}

// ─── Pickleball court SVG (used as the home now-card decoration) ──
function CourtIllustration({ width = 200, opacity = 0.95 }) {
  return (
    <svg width={width} viewBox="0 0 200 150" style={{ opacity }}>
      <defs>
        <linearGradient id="court-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c1f100"/>
          <stop offset="100%" stopColor="#abd600"/>
        </linearGradient>
      </defs>
      <g transform="translate(20 10) skewY(-8)">
        <rect x="0" y="0" width="160" height="120" rx="8" fill="url(#court-grad)" stroke="#001356" strokeWidth="3"/>
        <rect x="20" y="10" width="120" height="100" fill="#4d7cff" opacity="0.85" rx="2"/>
        <line x1="80" y1="10" x2="80" y2="110" stroke="white" strokeWidth="2"/>
        <line x1="20" y1="55" x2="60" y2="55" stroke="white" strokeWidth="2"/>
        <line x1="100" y1="55" x2="140" y2="55" stroke="white" strokeWidth="2"/>
        <line x1="20" y1="65" x2="60" y2="65" stroke="white" strokeWidth="2"/>
        <line x1="100" y1="65" x2="140" y2="65" stroke="white" strokeWidth="2"/>
      </g>
    </svg>
  );
}

// Tiny abstract people illustration for club hero
function PeopleIllustration({ width = 160, opacity = 0.6 }) {
  return (
    <svg width={width} viewBox="0 0 160 130" style={{ opacity }}>
      <circle cx="40" cy="40" r="16" fill="#c1f100"/>
      <path d="M22 100 Q22 70 40 70 Q58 70 58 100 Z" fill="#c1f100"/>
      <circle cx="80" cy="30" r="18" fill="#fff" opacity="0.9"/>
      <path d="M58 100 Q58 65 80 65 Q102 65 102 100 Z" fill="#fff" opacity="0.9"/>
      <circle cx="118" cy="42" r="15" fill="#ffd2c6"/>
      <path d="M102 100 Q102 72 118 72 Q134 72 134 100 Z" fill="#ffd2c6"/>
    </svg>
  );
}

Object.assign(window, { Avatar, TabBar, Sheet, Segmented, Toast, CourtIllustration, PeopleIllustration });
