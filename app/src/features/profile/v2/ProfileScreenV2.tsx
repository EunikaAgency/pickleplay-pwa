import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { ROLE_META, primaryRole } from '../../../shared/lib/roleDisplay';
import { getInitials } from '../../../shared/lib/initials';
import { listBookings, listGames, listMyTournaments, getMyOpenPlay, type ApiBooking, type ApiGame } from '../../../shared/lib/api';
import { useTheme, type ThemePreference } from '../../../shared/hooks/useTheme';
import { useNotificationStore } from '../../../shared/lib/notificationStore';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

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

/** Community-impact counts shown on an organizer's profile (instead of the
 *  player performance block). */
interface OrganizerMetrics { tournaments: number; openPlay: number; players: number }

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

const Chevron = ({ open = false }: { open?: boolean }) => (
  <svg className="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}><polyline points="9 18 15 12 9 6" /></svg>
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
  const role = user ? primaryRole(user) : 'player';
  const roleMeta = user ? ROLE_META[role] : null;
  // Games/Wins/Losses, win rate, activity & recent games are player-performance
  // stats — they only make sense for people who actually play (players, and
  // coaches who also play). Organizers run the community instead, so they get a
  // community-impact stats row (tournaments / open play / players) rather than
  // the competitive block. Admins/moderators get neither.
  const showPlayerStats = role === 'player' || role === 'coach';
  const showOrganizerStats = role === 'organizer';

  // Processed at fetch time (Date.now() must not run during render — purity rule).
  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);
  const [orgMetrics, setOrgMetrics] = useState<OrganizerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  // Appearance is collapsed by default; the theme options reveal on tap (like
  // the Account rows below), so the screen leads with a tidy single row.
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const currentTheme = THEMES.find((t) => t.id === theme);

  useEffect(() => {
    if (!isLoggedIn || !showPlayerStats) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      listBookings().catch(() => [] as ApiBooking[]),
      listGames({ mine: true }).catch(() => [] as ApiGame[]),
    ])
      .then(([bookings, games]) => {
        if (!alive) return;
        setMetrics(deriveMetrics(games, bookings, user?.id ?? '', Date.now()));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn, user?.id, showPlayerStats]);

  // Organizer KPIs: how many tournaments + open-play series they run, and the
  // total players reached across both (registered/joined counts). All best-effort.
  useEffect(() => {
    if (!isLoggedIn || !showOrganizerStats) return;
    let alive = true;
    Promise.all([
      listMyTournaments().catch(() => []),
      getMyOpenPlay().catch(() => ({ series: [], sessions: [] })),
    ])
      .then(([tournaments, openPlay]) => {
        if (!alive) return;
        const tPlayers = tournaments.reduce((n, t) => n + (t.registeredCount ?? t.registeredPlayers ?? 0), 0);
        const sPlayers = openPlay.sessions.reduce((n, s) => n + (s.joinedCount ?? 0), 0);
        setOrgMetrics({
          tournaments: tournaments.length,
          openPlay: openPlay.series.length,
          players: tPlayers + sPlayers,
        });
      });
    return () => { alive = false; };
  }, [isLoggedIn, showOrganizerStats]);

  return (
    <V2Shell screen="v2-profile" chrome={props}>
      {/* HEADER */}
      <div className="profile-header">
        {/* Spacer only — the notifications bell lives in the top chrome header,
            so the banner doesn't repeat it. Taller than the old bell row to give
            the avatar more breathing room in the blue banner. */}
        <div style={{ height: 80 }} />

        <div className="profile-card" style={{ margin: 0 }}>
          <div className="avatar-positioner">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt={name} />
                  : <span style={{ fontFamily: "'Grandstander', cursive", fontWeight: 800, fontSize: 28, color: 'var(--on-accent)' }}>{getInitials(name)}</span>}
              </div>
              {/* Avatar badge: skill tier only — the role is shown by the pill
                  below the name, so don't repeat it here as a fallback. */}
              {level && <div className="level-badge">{level}</div>}
            </div>
          </div>
          <h1 className="profile-name">{name}</h1>
          {roleMeta && (
            <div className="profile-role-pill" style={{ color: roleMeta.color, background: `${roleMeta.color}1A` }}>
              {roleMeta.label}
            </div>
          )}
          {user?.bio && <p className="profile-tagline">{user.bio}</p>}
          {showPlayerStats && (
            <div className="stats-row">
              <div className="stat-col"><span className="stat-col-number games">{metrics ? metrics.gamesPlayed : '—'}</span><span className="stat-col-label">Games</span></div>
              <div className="stat-col"><span className="stat-col-number wins">—</span><span className="stat-col-label">Wins</span></div>
              <div className="stat-col"><span className="stat-col-number losses">—</span><span className="stat-col-label">Losses</span></div>
            </div>
          )}
          {showOrganizerStats && (
            <div className="stats-row">
              <div className="stat-col"><span className="stat-col-number games">{orgMetrics ? orgMetrics.tournaments : '—'}</span><span className="stat-col-label">Tournaments</span></div>
              <div className="stat-col"><span className="stat-col-number games">{orgMetrics ? orgMetrics.openPlay : '—'}</span><span className="stat-col-label">Open play</span></div>
              <div className="stat-col"><span className="stat-col-number games">{orgMetrics ? orgMetrics.players : '—'}</span><span className="stat-col-label">Players</span></div>
            </div>
          )}
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
            <ul className="settings-list">
              <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('organizer-hub')}>
                <div className="settings-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
                </div>
                <div className="settings-label">
                  <strong>Organizer console</strong>
                  <span>Tournaments, open play &amp; rosters</span>
                </div>
                <Chevron />
              </li>
            </ul>
          </div>
        )}

        {userHasPermission(user, 'admin.moderation.manage') && (
          <div className="content-section">
            <h2 className="section-title">Admin</h2>
            <ul className="settings-list">
              <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('admin-claims')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('admin-claims'); } }}>
                <div className="settings-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
                </div>
                <div className="settings-label">
                  <strong>Venue claims</strong>
                  <span>Review ownership claims</span>
                </div>
                <Chevron />
              </li>
            </ul>
          </div>
        )}

        {showPlayerStats && (
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
        )}

        {showPlayerStats && (
          <div className="content-section">
            <h2 className="section-title">Activity</h2>
            <div className="activity-grid">
              <div className="activity-card"><div className="activity-card-label">Last Played</div><div className="activity-card-value">{metrics?.lastPlayed || '—'}</div><div className="activity-card-sub">&nbsp;</div></div>
              <div className="activity-card"><div className="activity-card-label">Played</div><div className="activity-card-value">{metrics ? metrics.played : '—'}</div><div className="activity-card-sub">sessions</div></div>
              <div className="activity-card"><div className="activity-card-label">Frequency</div><div className="activity-card-value">{metrics?.frequency || '—'}</div><div className="activity-card-sub">per week</div></div>
              <div className="activity-card"><div className="activity-card-label">Best Week</div><div className="activity-card-value">{metrics ? metrics.bestWeek : '—'}</div><div className="activity-card-sub">sessions</div></div>
            </div>
          </div>
        )}

        {/* RECENT GAMES — the player's past games (listGames mine), newest first.
            No scores yet (the API exposes no match results), so rows show the
            game + a Hosted/Joined tag instead of a W/L result. */}
        {isLoggedIn && showPlayerStats && (
          <div className="content-section">
            <h2 className="section-title">Recent Games</h2>
            {loading ? (
              <V2Skeleton variant="match-list" count={3} />
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

        {showPlayerStats && (
          <div className="content-section">
            <div className="upgrade-banner">
              <div className="upgrade-text"><strong>Unlock Full Stats</strong><p>Match history, leaderboards &amp; advanced analytics.</p></div>
              <button className="upgrade-pill">Go PRO</button>
            </div>
          </div>
        )}

        <div className="section-gap" />

        {/* SETTINGS — inlined here so the player sees every action on one screen
            (no drilling into a separate Settings page). */}
        <div className="content-section">
          <h2 className="section-title">Appearance</h2>
          <ul className="settings-list">
            <li
              className="settings-item"
              role="button"
              tabIndex={0}
              aria-expanded={appearanceOpen}
              onClick={() => setAppearanceOpen((v) => !v)}
            >
              <div className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
              </div>
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
              </li>
            )}
          </ul>
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
