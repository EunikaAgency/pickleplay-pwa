import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { apiImageUrl, listGames, type ApiGame } from '../../../shared/lib/api';

// Prefer the booked court's photo, then the venue's image, as an absolute URL.
function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

type Tab = 'my-games' | 'upcoming' | 'completed';

function typeBadge(g: ApiGame): { cls: string; label: string } {
  const t = (g.gameType || '').toLowerCase();
  if (t === 'doubles') return { cls: 'badge-competitive', label: 'Doubles' };
  if (t === 'singles') return { cls: 'badge-social', label: 'Singles' };
  return { cls: 'badge-open', label: 'Open Play' };
}
function gameTitle(g: ApiGame): string { return (g.title && g.title.trim()) || 'Pickleball game'; }
function gameWhen(g: ApiGame): string { return [g.whenLabel, g.timeLabel].filter(Boolean).join(' · ') || 'Time TBA'; }
function gameVenue(g: ApiGame): string { return g.venue?.displayName || g.venueName || 'Venue TBA'; }
function slots(g: ApiGame): { joined: number; cap: number; pct: number; almost: boolean } {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct, almost: cap > 0 && g.spotsLeft != null && g.spotsLeft <= 1 };
}

// Build the next 7 days for the date strip.
function nextDays(n: number): { ymd: string; day: string; label: string }[] {
  const out: { ymd: string; day: string; label: string }[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' });
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    out.push({ ymd, day, label });
  }
  return out;
}

export function GamesScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, isLoggedIn } = chrome;
  const [tab, setTab] = useState<Tab>(isLoggedIn ? 'my-games' : 'upcoming');
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = useMemo(() => nextDays(7), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const req = tab === 'my-games'
      ? (isLoggedIn ? listGames({ mine: true }) : Promise.resolve([]))
      : tab === 'completed'
        ? listGames({ status: 'completed' })
        : listGames({ status: 'published' });
    req.then((rows) => { if (alive) setGames(rows); })
      .catch(() => { if (alive) setGames([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab, isLoggedIn]);

  const showDateStrip = tab !== 'completed';
  const visible = useMemo(() => {
    if (!showDateStrip || !selectedDate) return games;
    return games.filter((g) => g.date === selectedDate);
  }, [games, selectedDate, showDateStrip]);

  const segBtn = (value: Tab, label: string) => (
    <button
      className={`seg-btn${tab === value ? ' active' : ''}`}
      role="tab"
      aria-selected={tab === value}
      onClick={() => { setTab(value); setSelectedDate(null); }}
    >
      {label}
    </button>
  );

  return (
    <V2Shell screen="v2-games" chrome={chrome}>
      <div className="page-content">
        <div className="tab-group-row">
          <div className="tab-group" role="tablist" aria-label="Games view">
            {segBtn('my-games', 'My Games')}
            {segBtn('upcoming', 'Upcoming')}
            {segBtn('completed', 'Completed')}
          </div>
        </div>

        {showDateStrip && (
          <div className="date-strip-wrap">
            <div className="date-strip" role="group" aria-label="Filter by date">
              {days.map((d) => {
                const has = games.some((g) => g.date === d.ymd);
                const active = selectedDate === d.ymd;
                return (
                  <button
                    key={d.ymd}
                    className={`date-chip${active ? ' active' : ''}${has && !active ? ' has-games' : ''}`}
                    aria-pressed={active}
                    onClick={() => setSelectedDate(active ? null : d.ymd)}
                  >
                    <span className="date-day">{d.day}</span>
                    <span className="date-label">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <p className="game-meta" style={{ padding: '20px 4px' }}>Loading games…</p>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-ring">🎾</div>
            <h3>{tab === 'my-games' && !isLoggedIn ? 'Sign in to see your games' : 'No games here yet'}</h3>
            <p>{tab === 'my-games' ? 'Games you create or join show up here.' : tab === 'completed' ? 'Your finished games will appear here.' : 'No open games right now.'}</p>
            <button className="empty-cta" onClick={chrome.onCreate}>Create a game</button>
          </div>
        ) : (
          visible.map((g) => {
            const badge = typeBadge(g);
            const s = slots(g);
            return (
              <a key={g.id} className="game-card" role="button" onClick={() => onNavigate('game-details', { id: g.id })}>
                <div className="game-thumb" style={gameImage(g) ? { backgroundImage: `url(${gameImage(g)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                  <span className={`game-type-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="game-body">
                  <div className="game-title">{gameTitle(g)}</div>
                  <div className="game-meta">
                    <div className="game-meta-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {gameWhen(g)}
                    </div>
                    <div className="game-meta-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {gameVenue(g)}
                    </div>
                  </div>
                  {s.cap > 0 && (
                    <div className="players-row">
                      <div className="fill-track"><div className={`fill-bar${s.almost ? ' near-full' : ''}`} style={{ width: `${s.pct}%` }} /></div>
                      <span className="players-label">{s.joined}/{s.cap}</span>
                    </div>
                  )}
                </div>
              </a>
            );
          })
        )}
      </div>
    </V2Shell>
  );
}
