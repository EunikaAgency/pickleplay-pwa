import { useState, type ReactNode } from 'react';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { ROLE_META, primaryRole } from '../../shared/lib/roleDisplay';
import { getInitials } from '../../shared/lib/initials';
import { money } from '../bookings/bookingDisplay';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { useTheme, type ThemePreference } from '../../shared/hooks/useTheme';
import { useNotificationStore } from '../../shared/lib/notificationStore';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerProfileScreenProps {
  onNavigate: Navigate;
  onLogout: () => void;
}

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// ── Inline stroke icons (matching the v2.1 profile design) ──
type Ico = { size?: number };
const Bell = ({ size = 22 }: Ico) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
const Chevron = ({ open = false }: { open?: boolean }) => (<svg className="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}><polyline points="9 18 15 12 9 6" /></svg>);
const Sun = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>);
const Storefront = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h0M9 12h0M9 15h0" /></svg>);
const CalendarIco = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const TrendUp = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>);
const Plus = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
const UserIco = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
const UsersIco = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
const SettingsIco = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
const LogOut = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
const Trophy = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>);
const Shield = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>);
const Flag = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>);

type Row = { key: string; icon: ReactNode; label: string; sub: string; onClick: () => void; badge?: number; danger?: boolean; className?: string };

function SettingsRow({ r }: { r: Row }) {
  return (
    <li className={r.className ? 'settings-item ' + r.className : 'settings-item'} role="button" tabIndex={0} onClick={r.onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.onClick(); } }}>
      <div className={`settings-icon${r.danger ? ' danger' : ''}`}>{r.icon}</div>
      <div className="settings-label">
        <strong style={r.danger ? { color: 'var(--error)' } : undefined}>{r.label}</strong>
        <span>{r.sub}</span>
      </div>
      {r.badge != null && r.badge > 0 && <span className="badge-pill">{r.badge > 9 ? '9+' : r.badge}</span>}
      {!r.danger && <Chevron />}
    </li>
  );
}

// Owner's Profile tab — the player v2.1 profile design (.v2-profile) populated
// with the owner's account + venue-business content. Players/guests get the
// player ProfileScreen(V2) instead; App.tsx branches the profile tab on
// owner.access. Reuses the shared `.v2c-topnav` chrome + `.v2-profile` classes.
export function OwnerProfileScreen({ onNavigate, onLogout }: OwnerProfileScreenProps) {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const currentTheme = THEMES.find((t) => t.id === theme);
  const unread = useNotificationStore((s) => s.unread);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  // The same gate the recurring-Open-Play screen uses: whoever manages the venue.
  const canManage = userHasPermission(user, 'owner.venues.manage');
  const canCreate = userHasPermission(user, 'owner.venues.create');
  const canStaff = userHasPermission(user, 'owner.staff.manage');
  const canNotifs = userHasPermission(user, 'owner.notifications.view');
  const isOrganizer = userHasPermission(user, 'organizer.access');
  const canModerate = userHasPermission(user, 'admin.moderation.manage');
  // Admins aren't venue owners — they don't manage venues/shop/calendar/
  // reservations/partners, so the whole owner "Manage" section is hidden.
  const isAdmin = userHasPermission(user, 'admin.access');
  // /owner/reports is owner-only — staff don't see the business-wide roll-up.
  const canReports = userHasPermission(user, 'owner.reports.view');
  // Staff land on this same console (they hold owner.access) — show their real
  // role on the badge, and label them "Venue staff" rather than "Venue owner".
  const role = user ? primaryRole(user) : 'owner';
  // Staff see no revenue/bookings roll-up, so don't pay for it: both flags fan
  // out one request per venue, and a staff member inherits their owner's whole
  // portfolio (which can be hundreds of venues).
  const isStaff = role === 'staff';
  // An owner can grant a staff member `owner.analytics.view` from the Access
  // panel; that grant opens the Reports page for them (see the Reports row +
  // the owner-bookings screen gate in App.tsx).
  const hasAnalyticsGrant = userHasPermission(user, 'owner.analytics.view');
  const {
    canAnalytics, venues, combined, structural, statsReady, monthBookings, pending, status, retry,
  } = useOwnerDashboard({ withBookings: canBookings && !isStaff, withAnalytics: !isStaff });

  const name = user?.displayName ?? 'Owner';
  const roleMeta = ROLE_META[role] ?? ROLE_META.owner;
  const roleNoun = role === 'staff' ? 'Venue staff' : 'Venue owner';
  const pendingCount = canBookings ? pending.length : combined.pending;
  const venueLine = venues.length > 0
    ? `${roleNoun} · ${venues.length} venue${venues.length === 1 ? '' : 's'}`
    : roleNoun;

  const manageRows: Row[] = [
    { key: 'venues', icon: <Storefront />, label: 'My venues', sub: `${venues.length} listed · ${structural.courts} courts`, onClick: () => onNavigate('owner-venues') },
    { key: 'shop', icon: <Storefront />, label: 'Shop/Rental', sub: 'Rental inventory & equipment', onClick: () => onNavigate('owner-shop') },
    { key: 'members', icon: <UsersIco />, label: 'Members', sub: 'Your community & memberships', onClick: () => onNavigate('members') },
    { key: 'calendar', icon: <CalendarIco />, label: 'Calendar', sub: 'Court-by-court booking schedule', onClick: () => onNavigate('owner-calendar'), className: 'sm:hidden' },
    ...(canBookings ? [{ key: 'manual-reservation', icon: <Plus />, label: 'Manual reservation', sub: 'Record a phone / walk-in booking', onClick: () => onNavigate('owner-manual-reservation', {}), className: 'mtonly' } as Row] : []),
    // §5.3 — recurring Open Play used to be organizer-only, so an owner running the
    // same session every Tuesday had to re-create it by hand, week after week.
    ...(canManage ? [{ key: 'recurring-open-play', icon: <CalendarIco />, label: 'Recurring Open Play', sub: 'Run the same session every week', onClick: () => onNavigate('organizer-open-play') } as Row] : []),
    { key: 'partners', icon: <UsersIco />, label: 'Partners', sub: 'Coaches & organisers at your venues', onClick: () => onNavigate('owner-partners'), className: 'sm:hidden' },
    ...(canReports || hasAnalyticsGrant ? [{ key: 'reports', icon: <TrendUp />, label: 'Reports', sub: 'Revenue, KPIs & venue performance', onClick: () => onNavigate('owner-bookings', {}) } as Row] : []),
    ...(canReports ? [{ key: 'settlements', icon: <TrendUp />, label: 'Settlements', sub: 'Payout balance, history & GCash details', onClick: () => onNavigate('owner-settlements') } as Row] : []),
    ...(canStaff ? [{ key: 'staff', icon: <UsersIco />, label: 'Staff', sub: 'Accounts that manage your venues, bookings & clubs', onClick: () => onNavigate('owner-staff') } as Row] : []),
    ...(canCreate ? [{ key: 'new-venue', icon: <Plus />, label: 'New venue', sub: 'List another court', onClick: () => onNavigate('owner-new-venue') } as Row] : []),
  ];

  const accountRows: Row[] = [
    { key: 'edit', icon: <UserIco />, label: 'Edit Profile', sub: 'Name, photo & bio', onClick: () => onNavigate('edit-profile') },
    ...(canNotifs ? [{ key: 'notifs', icon: <Bell size={18} />, label: 'Notifications', sub: 'Booking & venue alerts', onClick: () => onNavigate('notifications'), badge: unread } as Row] : []),
    ...(isOrganizer ? [{ key: 'organize', icon: <Trophy />, label: 'Organizer console', sub: 'Tournaments & open play', onClick: () => onNavigate('organizer-hub') } as Row] : []),
    ...(canModerate ? [{ key: 'claims', icon: <Shield />, label: 'Venue claims', sub: 'Review ownership claims', onClick: () => onNavigate('admin-claims') } as Row] : []),
    ...(canModerate ? [{ key: 'post-reports', icon: <Flag />, label: 'Post reports', sub: 'Review reported posts', onClick: () => onNavigate('admin-post-reports') } as Row] : []),
    { key: 'settings', icon: <SettingsIco />, label: 'Settings', sub: 'Privacy & preferences', onClick: () => onNavigate('settings') },
  ];

  if (status === 'loading' && venues.length === 0) {
    return <div className="pb-v2 v2-profile"><div className="p-4 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--surface-2)] animate-pulse" />)}</div></div>;
  }
  if (status === 'error') {
    return <div className="pb-v2 v2-profile"><ErrorState message="Couldn't load dashboard." onRetry={retry} /></div>;
  }

  return (
    <div className="pb-v2 v2-profile">
      {/* Top chrome (shared v2 nav) */}
      <header className="v2c-topnav">
        <div className="v2c-inner">
          <span style={{ width: 40 }} aria-hidden="true" />
          <button className="v2c-brand" onClick={() => onNavigate('home')} aria-label="Home">Pickle<span>Ballers</span></button>
          <div className="v2c-actions">
            <button className="v2c-iconbtn" aria-label="Notifications" onClick={() => onNavigate('notifications')}>
              <Bell />
              {unread > 0 && (
                <span className="v2c-notif-badge" aria-label={`${unread} unread notifications`}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HEADER — avatar, name, owner badge, business stats */}
      <div className="profile-header">
        <div style={{ height: 80 }} />
        <div className="profile-card" style={{ margin: 0 }}>
          <div className="avatar-positioner">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt={name} />
                  : <span style={{ fontFamily: "'Grandstander', cursive", fontWeight: 800, fontSize: 28, color: 'var(--on-accent)' }}>{getInitials(name)}</span>}
              </div>
              {/* No role on the avatar badge — the role pill below the name shows
                  it, so a "Owner" badge here would just repeat it. */}
            </div>
          </div>
          <h1 className="profile-name">{name}</h1>
          <div className="profile-role-pill" style={{ color: roleMeta.color, background: `${roleMeta.color}1A` }}>
            {roleMeta.label}
          </div>
          <p className="profile-tagline" style={{ fontStyle: 'normal' }}>{user?.bio || venueLine}</p>
          {/* Portfolio counts read as the viewer's own; staff don't own any of it. */}
          {!isStaff && (
            <div className="stats-row">
              <div className="stat-col"><span className="stat-col-number games">{venues.length}</span><span className="stat-col-label">Venues</span></div>
              <div className="stat-col"><span className="stat-col-number games">{structural.courts}</span><span className="stat-col-label">Courts</span></div>
              <div className="stat-col"><span className="stat-col-number games">{statsReady ? monthBookings : '—'}</span><span className="stat-col-label">Bookings</span></div>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button className="edit-profile-btn" onClick={() => onNavigate('edit-profile')}>Edit Profile</button>
          </div>
        </div>
      </div>

      <div>
        {/* BUSINESS KPIs — mirrors the player Activity grid. Hidden for staff:
            the revenue/bookings roll-up is the owner's business, not theirs. */}
        {canAnalytics && !isStaff && (
          <div className="content-section">
            <h2 className="section-title">This month</h2>
            <div className="activity-grid">
              <div className="activity-card"><div className="activity-card-label">Revenue</div><div className="activity-card-value">{statsReady ? money(combined.month) : '—'}</div><div className="activity-card-sub">this month</div></div>
              <div className="activity-card"><div className="activity-card-label">Revenue</div><div className="activity-card-value">{statsReady ? money(combined.week) : '—'}</div><div className="activity-card-sub">this week</div></div>
              <div className="activity-card"><div className="activity-card-label">Bookings</div><div className="activity-card-value">{statsReady ? combined.todayBookings : '—'}</div><div className="activity-card-sub">today</div></div>
              <div className="activity-card"><div className="activity-card-label">Awaiting</div><div className="activity-card-value">{statsReady ? pendingCount : '—'}</div><div className="activity-card-sub">approval</div></div>
            </div>
          </div>
        )}

        {/* MANAGE — owner venue-business actions (hidden for admins, who aren't
            venue owners and don't manage venues/shop/calendar/reservations/partners) */}
        {!isAdmin && (
          <div className="content-section">
            <h2 className="section-title">Manage</h2>
            <ul className="settings-list">
              {manageRows.map((r) => <SettingsRow key={r.key} r={r} />)}
            </ul>
          </div>
        )}

        {!isAdmin && <div className="section-gap" />}

        {/* ACCOUNT */}
        <div className="content-section">
          <h2 className="section-title">Account</h2>
          <ul className="settings-list">
            {accountRows.map((r) => <SettingsRow key={r.key} r={r} />)}
          </ul>
        </div>

        {/* APPEARANCE — collapsible Theme row (matches the player profile) */}
        <div className="content-section">
          <h2 className="section-title">Appearance</h2>
          <ul className="settings-list">
            <li className="settings-item" role="button" tabIndex={0} aria-expanded={appearanceOpen}
              onClick={() => setAppearanceOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAppearanceOpen((v) => !v); } }}>
              <div className="settings-icon"><Sun /></div>
              <div className="settings-label">
                <strong>Theme</strong>
                <span>{currentTheme?.label ?? 'System'}</span>
              </div>
              <Chevron open={appearanceOpen} />
            </li>
            {appearanceOpen && (
              <li style={{ display: 'flex', gap: 8, padding: '12px 0 4px' }}>
                {THEMES.map((opt) => {
                  const active = theme === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setTheme(opt.id)} aria-pressed={active}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 13, background: active ? 'var(--lime)' : 'var(--bg-app)', color: active ? 'var(--on-accent)' : 'var(--ink)', border: `1px solid ${active ? 'var(--lime-active)' : 'var(--border-subtle)'}` }}>
                      {opt.label}
                    </button>
                  );
                })}
              </li>
            )}
          </ul>
        </div>

        {/* LOG OUT */}
        <div className="content-section">
          <ul className="settings-list">
            <SettingsRow r={{ key: 'logout', icon: <LogOut />, label: 'Log Out', sub: 'Sign out of your account', onClick: onLogout, danger: true }} />
          </ul>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
