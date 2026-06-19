import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { getInitials } from '../../../shared/lib/initials';
import { listBookings, listGames, type ApiBooking, type ApiGame } from '../../../shared/lib/api';
import { useTheme, type ThemePreference } from '../../../shared/hooks/useTheme';
import { useNotificationStore } from '../../../shared/lib/notificationStore';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// --- Local booking formatters --------------------------------------------------
// Kept inline (not imported from features/bookings/) so the profile slice doesn't
// cross-import another feature — same rule home/ follows for gameDisplay.ts.

/** "Jun 7" + "Sat · 6:00–7:00 PM" style parts for a booking-history row. */
function bookingWhen(b: ApiBooking): { mon: string; day: string; line: string } {
  const ymd = b.date ?? '';
  const d = ymd ? new Date(`${ymd}T00:00:00`) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const mon = valid ? d!.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : '—';
  const day = valid ? String(d!.getDate()) : '';
  const wd = valid ? d!.toLocaleDateString(undefined, { weekday: 'short' }) : '';
  const time = timeRange(b.startTime, b.endTime);
  const line = [wd, time].filter(Boolean).join(' · ');
  return { mon, day, line };
}

function to12h(hhmm?: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timeRange(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const s = to12h(start);
  if (!end) return s;
  const e = to12h(end);
  return s.slice(-2) === e.slice(-2) ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;
}

/** Date-aware status badge tone for a booking-history row. */
function bookingBadge(b: ApiBooking, now: number): { label: string; color: string; bg: string } {
  if (b.status === 'cancelled') return { label: 'Cancelled', color: 'var(--text-muted)', bg: 'var(--bg-app)' };
  if (b.status === 'pending_approval') return { label: 'Pending', color: 'var(--coral)', bg: 'rgba(239,68,68,0.1)' };
  const start = b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN;
  return Number.isNaN(start) || start >= now
    ? { label: 'Upcoming', color: 'var(--blue)', bg: 'rgba(59,130,246,0.12)' }
    : { label: 'Completed', color: 'var(--success)', bg: 'rgba(34,197,94,0.12)' };
}

/** Sort key (date + start time) so the history reads newest-first. */
function bookingTs(b: ApiBooking): number {
  if (!b.date) return 0;
  const t = new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const DAY_MS = 86_400_000;

/** Midnight (local) for a YYYY-MM-DD; NaN when missing/unparseable. */
function dayTs(ymd?: string | null): number {
  if (!ymd) return NaN;
  const t = new Date(`${ymd}T00:00:00`).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Month/day parts for a date badge, e.g. { mon: 'JUN', day: '7' }. */
function dateParts(ymd?: string | null): { mon: string; day: string } {
  const t = dayTs(ymd);
  if (Number.isNaN(t)) return { mon: '—', day: '' };
  const d = new Date(t);
  return { mon: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(), day: String(d.getDate()) };
}

/** "Today" / "Yesterday" / "3d ago" / "2w ago" / "Mar 4" relative to today. */
function relDay(ts: number, todayStart: number): string {
  const days = Math.round((todayStart - new Date(ts).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Monday-anchored week bucket key, for the "best week" tally. */
function weekKey(ts: number): string {
  const d = new Date(ts);
  const back = (d.getDay() + 6) % 7; // days since Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

interface GameRow { id: string; mon: string; day: string; title: string; sub: string; role: 'Hosted' | 'Joined' }

interface ProfileMetrics {
  gamesPlayed: number;
  played: number;        // total past sessions (games + bookings)
  lastPlayed: string;    // relative label, '' when none
  frequency: string;     // "1.5" sessions/week over the trailing window, '' when none
  bestWeek: number;
  recentGames: GameRow[];
}

/** Derive the profile's activity metrics + recent-games list from the player's
 *  past games and bookings. Pure (now/today passed in) so it stays out of render. */
function deriveMetrics(games: ApiGame[], bookings: ApiBooking[], userId: string, now: number): ProfileMetrics {
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const isPast = (ymd?: string | null, status?: string | null) => {
    const t = dayTs(ymd);
    return !Number.isNaN(t) && t < todayStart && status !== 'cancelled';
  };

  const pastGames = games.filter((g) => isPast(g.date, g.status));
  const sessionTs = [
    ...pastGames.map((g) => dayTs(g.date)),
    ...bookings.filter((b) => isPast(b.date, b.status)).map((b) => dayTs(b.date)),
  ].filter((t) => !Number.isNaN(t));

  const played = sessionTs.length;
  const lastPlayed = played ? relDay(Math.max(...sessionTs), todayStart) : '';

  const windowStart = now - 8 * 7 * DAY_MS;
  const recentSessions = sessionTs.filter((t) => t >= windowStart).length;
  const frequency = played ? (recentSessions / 8).toFixed(1) : '';

  const byWeek = new Map<string, number>();
  for (const t of sessionTs) byWeek.set(weekKey(t), (byWeek.get(weekKey(t)) ?? 0) + 1);
  const bestWeek = byWeek.size ? Math.max(...byWeek.values()) : 0;

  const recentGames: GameRow[] = [...pastGames]
    .sort((a, b) => dayTs(b.date) - dayTs(a.date))
    .slice(0, 4)
    .map((g) => {
      const { mon, day } = dateParts(g.date);
      const type = g.gameType ? g.gameType[0].toUpperCase() + g.gameType.slice(1) : '';
      const title = g.title || (type ? `${type} game` : 'Pickleball game');
      const venue = g.venue?.displayName || g.venueName || '';
      const when = relDay(dayTs(g.date), todayStart);
      return {
        id: g.id,
        mon,
        day,
        title,
        sub: [when, venue].filter(Boolean).join(' · '),
        role: g.creatorId === userId ? 'Hosted' : 'Joined',
      };
    });

  return { gamesPlayed: pastGames.length, played, lastPlayed, frequency, bestWeek, recentGames };
}

const Chevron = () => (
  <svg className="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

interface ProfileV2Props extends V2ScreenChrome {
  onLogout: () => void;
}

export function ProfileScreenV2(props: ProfileV2Props) {
  const { onNavigate, onLogout, isLoggedIn } = props;
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const unread = useNotificationStore((s) => s.unread);
  const name = user?.displayName ?? 'Guest';
  const level = user?.skillLevelLabel || (user?.skillLevel != null ? `${user.skillLevel.toFixed(1)} DUPR` : null);

  // Processed at fetch time (Date.now() must not run during render — purity rule).
  const [history, setHistory] = useState<{ b: ApiBooking; mon: string; day: string; line: string; badge: { label: string; color: string; bg: string } }[]>([]);
  const [hasBookings, setHasBookings] = useState(false);
  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      listBookings().catch(() => [] as ApiBooking[]),
      listGames({ mine: true }).catch(() => [] as ApiGame[]),
    ])
      .then(([bookings, games]) => {
        if (!alive) return;
        const now = Date.now();
        setHistory(
          [...bookings]
            .sort((a, b) => bookingTs(b) - bookingTs(a))
            .slice(0, 6)
            .map((b) => ({ b, ...bookingWhen(b), badge: bookingBadge(b, now) })),
        );
        setHasBookings(bookings.length > 0);
        setMetrics(deriveMetrics(games, bookings, user?.id ?? '', now));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn, user?.id]);

  return (
    <V2Shell screen="v2-profile" chrome={props}>
      {/* HEADER */}
      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px 8px', position: 'relative', zIndex: 1 }}>
          <button className="icon-btn" aria-label="Notifications" onClick={() => onNavigate('notifications')} style={{ color: '#fff' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </button>
        </div>

        <div className="profile-card" style={{ margin: 0 }}>
          <div className="avatar-positioner">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt={name} />
                  : <span style={{ fontFamily: "'Grandstander', cursive", fontWeight: 800, fontSize: 28, color: 'var(--on-accent)' }}>{getInitials(name)}</span>}
              </div>
              {level && <div className="level-badge">{level}</div>}
            </div>
          </div>
          <h1 className="profile-name">{name}</h1>
          {user?.bio && <p className="profile-tagline">{user.bio}</p>}
          <div className="stats-row">
            <div className="stat-col"><span className="stat-col-number games">{metrics ? metrics.gamesPlayed : '—'}</span><span className="stat-col-label">Games</span></div>
            <div className="stat-col"><span className="stat-col-number wins">—</span><span className="stat-col-label">Wins</span></div>
            <div className="stat-col"><span className="stat-col-number losses">—</span><span className="stat-col-label">Losses</span></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="edit-profile-btn" onClick={() => onNavigate('edit-profile')}>Edit Profile</button>
          </div>
        </div>
      </div>

      {/* CONTENT — Win Rate stays demo (no results API); Activity, Booking
          History + Recent Games are live (derived from games + bookings). */}
      <div>
        <div className="section-gap" />

        {userHasPermission(user, 'organizer.access') && (
          <div className="content-section">
            <h2 className="section-title">Organize</h2>
            <button
              className="edit-profile-btn"
              onClick={() => onNavigate('organizer-hub')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              Organizer console
            </button>
          </div>
        )}

        <div className="content-section">
          <h2 className="section-title">Win Rate</h2>
          <div className="winrate-row">
            <div className="winrate-label-group"><p>Play games to start tracking your win rate.</p></div>
            <div className="winrate-number">—</div>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Win rate">
            <div className="progress-fill" style={{ width: '0%' }} />
          </div>
        </div>

        <div className="content-section">
          <h2 className="section-title">Activity</h2>
          <div className="activity-grid">
            <div className="activity-card"><div className="activity-card-label">Last Played</div><div className="activity-card-value">{metrics?.lastPlayed || '—'}</div><div className="activity-card-sub">&nbsp;</div></div>
            <div className="activity-card"><div className="activity-card-label">Played</div><div className="activity-card-value">{metrics ? metrics.played : '—'}</div><div className="activity-card-sub">sessions</div></div>
            <div className="activity-card"><div className="activity-card-label">Frequency</div><div className="activity-card-value">{metrics?.frequency || '—'}</div><div className="activity-card-sub">per week</div></div>
            <div className="activity-card"><div className="activity-card-label">Best Week</div><div className="activity-card-value">{metrics ? metrics.bestWeek : '—'}</div><div className="activity-card-sub">sessions</div></div>
          </div>
        </div>

        {/* BOOKING HISTORY — real court bookings (listBookings), newest first. */}
        {isLoggedIn && (
          <div className="content-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Booking History</h2>
              {hasBookings && (
                <button
                  onClick={() => onNavigate('my-bookings')}
                  style={{ background: 'none', color: 'var(--blue)', fontWeight: 700, fontSize: 13 }}
                >
                  View all
                </button>
              )}
            </div>
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Loading your bookings…</p>
            ) : history.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                No court bookings yet. Book a court from Nearby to start your history.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {history.map(({ b, mon, day, line, badge }) => {
                  const venue = b.venueName || 'Court booking';
                  return (
                    <li key={b.id} className="match-item">
                      <div
                        className="match-result-badge"
                        style={{ flexDirection: 'column', gap: 0, lineHeight: 1, background: 'var(--bg-app)', color: 'var(--blue)' }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{mon}</span>
                        <span style={{ fontSize: 15 }}>{day}</span>
                      </div>
                      <div className="match-info">
                        <div className="match-info-top">{venue}</div>
                        <div className="match-info-sub">{line || '—'}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          color: badge.color,
                          background: badge.bg,
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="content-section">
          <div className="upgrade-banner">
            <div className="upgrade-text"><strong>Unlock Full Stats</strong><p>Match history, leaderboards &amp; advanced analytics.</p></div>
            <button className="upgrade-pill">Go PRO</button>
          </div>
        </div>

        <div className="section-gap" />

        {/* RECENT GAMES — the player's past games (listGames mine), newest first.
            No scores yet (the API exposes no match results), so rows show the
            game + a Hosted/Joined tag instead of a W/L result. */}
        {isLoggedIn && (
          <div className="content-section">
            <h2 className="section-title">Recent Games</h2>
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Loading your games…</p>
            ) : !metrics || metrics.recentGames.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                No games played yet. Join or host one from the Games tab.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {metrics.recentGames.map((g) => {
                  const hosted = g.role === 'Hosted';
                  return (
                    <li key={g.id} className="match-item">
                      <div
                        className="match-result-badge"
                        style={{ flexDirection: 'column', gap: 0, lineHeight: 1, background: 'var(--bg-app)', color: 'var(--blue)' }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>{g.mon}</span>
                        <span style={{ fontSize: 15 }}>{g.day}</span>
                      </div>
                      <div className="match-info">
                        <div className="match-info-top">{g.title}</div>
                        <div className="match-info-sub">{g.sub || '—'}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          color: hosted ? 'var(--on-accent)' : 'var(--blue)',
                          background: hosted ? 'var(--lime)' : 'rgba(59,130,246,0.12)',
                          flexShrink: 0,
                        }}
                      >
                        {g.role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="section-gap" />

        {/* SETTINGS — inlined here so the player sees every action on one screen
            (no drilling into a separate Settings page). */}
        <div className="content-section">
          <h2 className="section-title">Appearance</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  aria-pressed={active}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 700,
                    fontSize: 13,
                    background: active ? 'var(--lime)' : 'var(--bg-app)',
                    color: active ? 'var(--on-accent)' : 'var(--ink)',
                    border: `1px solid ${active ? 'var(--lime-active)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="content-section">
          <h2 className="section-title">Account</h2>
          <ul className="settings-list">
            <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('edit-profile')}>
              <div className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <div className="settings-label">
                <strong>Edit Profile</strong>
                <span>Name, photo &amp; bio</span>
              </div>
              <Chevron />
            </li>

            <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('notifications')}>
              <div className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <div className="settings-label">
                <strong>Notifications</strong>
                <span>Game alerts &amp; reminders</span>
              </div>
              {unread > 0 && <span className="badge-pill">{unread > 9 ? '9+' : unread}</span>}
              <Chevron />
            </li>

            <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('my-bookings')}>
              <div className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              </div>
              <div className="settings-label">
                <strong>My Bookings</strong>
                <span>Court reservations &amp; receipts</span>
              </div>
              <Chevron />
            </li>

            {userHasPermission(user, 'player.payments.view') && (
              <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('payment-history')}>
                <div className="settings-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
                <div className="settings-label">
                  <strong>Payment History</strong>
                  <span>Your spend report &amp; receipts</span>
                </div>
                <Chevron />
              </li>
            )}
          </ul>
        </div>

        {isLoggedIn && (
          <div className="content-section">
            <ul className="settings-list">
              <li className="settings-item" role="button" tabIndex={0} onClick={onLogout}>
                <div className="settings-icon danger">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </div>
                <div className="settings-label">
                  <strong style={{ color: 'var(--error)' }}>Log Out</strong>
                  <span>Sign out of your account</span>
                </div>
              </li>
            </ul>
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>
    </V2Shell>
  );
}
