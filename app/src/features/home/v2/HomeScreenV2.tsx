import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { useAuthStore } from '../../../shared/lib/authStore';
import { firstNameOf } from '../../../shared/lib/permissions';
import { apiImageUrl, listGames, listBookings, type ApiGame, type ApiBooking } from '../../../shared/lib/api';
import { getInitials } from '../../../shared/lib/initials';

// Prefer the booked court's photo, then the venue's image, as an absolute URL.
function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

// ── "Next commitment" helpers (home must not import the games slice's
//    formatters, so they're inlined here). ──
interface NextCommitment {
  kind: 'game' | 'booking';
  id: string;
  title: string;
  timeLabel: string;
  venueName: string;
  startsInMinutes: number;
}
function gameStartMs(g: ApiGame): number | null {
  if (!g.date) return null;
  const base = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const m = (g.timeLabel || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = m[3]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    base.setHours(h, parseInt(m[2], 10), 0, 0);
  }
  return base.getTime();
}
function bookingStartMs(b: ApiBooking): number | null {
  if (!b.date) return null;
  const base = new Date(`${b.date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const m = (b.startTime || '').match(/(\d{1,2}):(\d{2})/);
  if (m) base.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return base.getTime();
}
function clockLabel(time?: string | null): string {
  if (!time) return '';
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
/** Soonest upcoming game OR court booking (3h grace keeps a just-started one). */
function pickNextCommitment(games: ApiGame[], bookings: ApiBooking[]): NextCommitment | null {
  const now = Date.now();
  const GRACE = 3 * 3_600_000;
  const cands: { ms: number; c: NextCommitment }[] = [];
  for (const g of games) {
    if (g.status === 'cancelled') continue;
    const ms = gameStartMs(g);
    if (ms == null || ms < now - GRACE) continue;
    cands.push({ ms, c: { kind: 'game', id: g.id, title: (g.title && g.title.trim()) || 'Your game', timeLabel: g.timeLabel || g.whenLabel || '', venueName: g.venue?.displayName || g.venueName || 'Venue TBA', startsInMinutes: Math.round((ms - now) / 60_000) } });
  }
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const ms = bookingStartMs(b);
    if (ms == null || ms < now - GRACE) continue;
    cands.push({ ms, c: { kind: 'booking', id: b.id, title: b.venueName || 'Court booking', timeLabel: clockLabel(b.startTime), venueName: b.venueName || 'Court booking', startsInMinutes: Math.round((ms - now) / 60_000) } });
  }
  return cands.sort((a, b) => a.ms - b.ms)[0]?.c ?? null;
}
/** Friendly relative time for the eyebrow. */
function whenLabel(mins: number): string {
  if (mins <= 0) return 'Happening now';
  if (mins < 60) return `In ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `In ${h} hr`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Tomorrow' : `In ${d} days`;
}

// Local formatters — the home slice must not import the games slice's gameDisplay.
function gameTitle(g: ApiGame): string {
  return (g.title && g.title.trim()) || 'Pickleball game';
}
// Format a YYYY-MM-DD game date as a friendly day label ("Today" / "Tomorrow" /
// "Sat, Jun 20"). Parsed from local date parts so it doesn't shift by timezone.
function dayLabel(ymd?: string | null): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
// Always show the date when we have one; only the time falls back to "TBA".
function gameWhen(g: ApiGame): string {
  const day = dayLabel(g.date) || g.whenLabel || '';
  const time = g.timeLabel || '';
  if (day) return `${day} · ${time || 'Time TBA'}`;
  return time || 'Time TBA';
}
function gameVenue(g: ApiGame): string {
  return g.venue?.displayName || g.venueName || 'Venue TBA';
}
function joinedOf(g: ApiGame): { joined: number; cap: number; pct: number; almost: boolean } {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct, almost: cap > 0 && g.spotsLeft != null && g.spotsLeft <= 1 };
}
// Open Play games are interest-based (no roster/slots). Inlined locally — home
// doesn't cross-import the games slice's gameDisplay.
function isOpenPlayGame(g: ApiGame): boolean {
  return ((g.gameType || '').toLowerCase() || 'open') === 'open';
}
function interestOf(g: ApiGame): number {
  return g.interestedCount ?? g.interestedUsers?.length ?? 0;
}
function levelClass(g: ApiGame): { cls: string; label: string } {
  const s = (g.skillLabel || '').toLowerCase();
  if (s.includes('begin')) return { cls: 'level-beginner', label: g.skillLabel || 'Beginner' };
  if (s.includes('adv') || s.includes('comp')) return { cls: 'level-advanced', label: g.skillLabel || 'Advanced' };
  return { cls: 'level-mixed', label: g.skillLabel || 'All levels' };
}

export function HomeScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate } = chrome;
  const user = useAuthStore((s) => s.user);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [commitment, setCommitment] = useState<NextCommitment | null>(null);

  useEffect(() => {
    let alive = true;
    // loading starts true; this runs once on mount.
    listGames({ status: 'published' })
      .then((rows) => { if (alive) setGames(rows); })
      .catch(() => { if (alive) setGames([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // The signed-in player's soonest upcoming game or court booking (powers the
  // "Up next" banner). Guests skip the fetch (banner shows a join CTA instead).
  useEffect(() => {
    if (!chrome.isLoggedIn) return; // guests: leave commitment null (banner shows a join CTA)
    let alive = true;
    Promise.all([
      listGames({ mine: true }).catch(() => [] as ApiGame[]),
      listBookings().catch(() => [] as ApiBooking[]),
    ]).then(([mine, bookings]) => { if (alive) setCommitment(pickNextCommitment(mine, bookings)); });
    return () => { alive = false; };
  }, [chrome.isLoggedIn]);

  const featured = games[0] ?? null;
  const discover = games.slice(featured ? 1 : 0, featured ? 7 : 6);
  const firstName = firstNameOf(user);
  const greeting = firstName ? `Ready to play, ${firstName}?` : 'Ready to play?';

  return (
    <V2Shell screen="v2-home" chrome={chrome} hideBack>
      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-text">
              <h1>{greeting}</h1>
              <p>Discover games, open play, and court bookings.</p>
              <div className="live-chip">
                <span className="live-dot" />
                {loading ? 'Loading games…' : `${games.length} open game${games.length === 1 ? '' : 's'} near you`}
              </div>
            </div>
            <button
              type="button"
              className="hero-mascot"
              onClick={() => chrome.onTabPress('profile')}
              aria-label={user ? 'Open your profile' : 'Sign in'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: "'Grandstander', cursive", fontWeight: 800, fontSize: 24, color: 'var(--on-accent)' }}
            >
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user.displayName} />
                : user ? getInitials(user.displayName) : '👋'}
            </button>
          </div>
        </div>
      </section>

      <div className="container">
        {/* QUICK ACTIONS */}
        <section className="quick-actions" aria-label="Quick actions">
          <button className="qa-card qa-lime" onClick={chrome.onCreate}>
            <span className="qa-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <span className="qa-label">Play</span>
          </button>
          <button className="qa-card qa-blue" onClick={() => onNavigate('nearby')}>
            <span className="qa-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </span>
            <span className="qa-label">Book Court</span>
          </button>
        </section>

        {/* FEATURED — while loading, show the heading + a hero skeleton so the
            card reserves its space instead of popping in (and shoving Discover
            down) once games arrive. */}
        {loading ? (
          <section className="section" aria-label="Featured game">
            <div className="section-head"><h2>Featured Today</h2></div>
            <V2Skeleton variant="home-featured" />
          </section>
        ) : featured ? (
          <section className="section" aria-label="Featured game">
            <div className="section-head"><h2>Featured Today</h2></div>
            <div className="featured">
              <div className="featured-media" style={gameImage(featured) ? { backgroundImage: `url(${gameImage(featured)})` } : undefined}>
                <span className="badge-pill">{featured.whenLabel || 'Upcoming'}</span>
                {isOpenPlayGame(featured)
                  ? interestOf(featured) > 0 && (
                      <span className="spots-badge">{interestOf(featured)} interested</span>
                    )
                  : featured.spotsLeft != null && featured.spotsLeft > 0 && (
                      <span className="spots-badge">{featured.spotsLeft} spot{featured.spotsLeft === 1 ? '' : 's'} left!</span>
                    )}
                <div className="featured-overlay-text"><h2>{gameTitle(featured)}</h2></div>
              </div>
              <div className="featured-content">
                <div className="meta-row">
                  <span>{gameWhen(featured)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{gameVenue(featured)}</span>
                </div>
                <div className="avatar-row">
                  <span className="avatar-label">
                    {isOpenPlayGame(featured)
                      ? `${interestOf(featured)} interested`
                      : `${joinedOf(featured).joined} of ${joinedOf(featured).cap || '?'} joined`}
                  </span>
                </div>
                <div className="cta-row">
                  <button className="btn-lime" onClick={() => isOpenPlayGame(featured) ? onNavigate('open-play-detail', { source: 'game', id: featured.id }) : onNavigate('game-details', { id: featured.id })}>View Details</button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* DISCOVER */}
        <section className="section" aria-label="Discover games">
          <div className="section-head">
            <h2>Discover Games</h2>
            <button className="see-all" onClick={() => onNavigate('games')}>See All</button>
          </div>
          {loading ? (
            <V2Skeleton variant="home-discover" />
          ) : discover.length === 0 ? (
            <p className="meta-row">No open games right now — be the first to create one.</p>
          ) : (
            <div className="scroll-row">
              {discover.map((g) => {
                const lvl = levelClass(g);
                const slot = joinedOf(g);
                const img = gameImage(g);
                return (
                  <article key={g.id} className="game-card" onClick={() => isOpenPlayGame(g) ? onNavigate('open-play-detail', { source: 'game', id: g.id }) : onNavigate('game-details', { id: g.id })} role="button">
                    <div className="game-img" style={img ? { backgroundImage: `url(${img})` } : undefined}>
                      <span className={`level-tag ${lvl.cls}`}>{lvl.label}</span>
                    </div>
                    <div className="game-body">
                      <h3>{gameTitle(g)}</h3>
                      <div className="meta-row"><span>{gameWhen(g)}</span></div>
                      {isOpenPlayGame(g) ? (
                        <div className="slots-row">
                          <span className="slots-label">{interestOf(g)} interested</span>
                        </div>
                      ) : (
                        <div className="slots-row">
                          <div className="slots-bar"><div className={`slots-fill${slot.almost ? ' almost' : ''}`} style={{ width: `${slot.pct}%` }} /></div>
                          <span className="slots-label">{slot.joined}/{slot.cap || '?'} spots</span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* "UP NEXT" banner — real data: the player's soonest game/booking, else a
            find-a-game prompt (logged in) or a join CTA (guests). Replaces the old
            static wins/rank stats (the API exposes no player stats). */}
        {commitment ? (
          <section className="stats-banner" aria-label="Your next commitment">
            <div>
              <p className="t-eyebrow" style={{ color: 'var(--lime)', fontWeight: 700, fontSize: 11, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>
                {commitment.startsInMinutes <= 0 ? 'Happening now' : `Up next · ${whenLabel(commitment.startsInMinutes)}`}
              </p>
              <h3>{commitment.title}</h3>
              <p className="sub">{[commitment.timeLabel, commitment.venueName].filter(Boolean).join(' · ')}</p>
            </div>
            <button
              className="btn-lime"
              onClick={() => (commitment.kind === 'booking' ? onNavigate('my-bookings') : onNavigate('game-details', { id: commitment.id }))}
            >
              {commitment.kind === 'booking' ? 'View booking' : 'View game'}
            </button>
          </section>
        ) : chrome.isLoggedIn ? (
          <section className="stats-banner" aria-label="Find a game">
            <div>
              <h3>No games on your calendar</h3>
              <p className="sub">{games.length > 0 ? `${games.length} open game${games.length === 1 ? '' : 's'} near you right now.` : 'Find a game or book a court to get playing.'}</p>
            </div>
            <button className="btn-lime" onClick={() => onNavigate('games')}>Find a game</button>
          </section>
        ) : (
          <section className="stats-banner" aria-label="Join PickleBallers">
            <div>
              <h3>Join the community</h3>
              <p className="sub">Sign up to join games, book courts, and track what's next.</p>
            </div>
            <button className="btn-lime" onClick={() => chrome.requireAuth('join the community')}>Get started</button>
          </section>
        )}

        <div style={{ height: 16 }} />
      </div>
    </V2Shell>
  );
}
