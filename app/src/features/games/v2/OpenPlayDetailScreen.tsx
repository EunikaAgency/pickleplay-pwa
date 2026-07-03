import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { CourtIllustration } from '../../../shared/components/ui/CourtIllustration';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { GameDetailsScreen } from '../GameDetailsScreen';
import { type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import {
  getGame, getOpenPlaySession, joinOpenPlaySession, leaveOpenPlaySession,
  type ApiOpenPlaySession,
} from '../../../shared/lib/api';
import { money, prettyDate, to12h } from '../../bookings/bookingDisplay';

interface Props {
  source: 'auto' | 'game' | 'session';
  id: string;
  chrome: V2ScreenChrome;
  onBack: () => void;
}

function timeRange(s: ApiOpenPlaySession): string {
  const start = s.startTime ? to12h(s.startTime) : '';
  const end = s.endTime ? to12h(s.endTime) : '';
  return [start, end].filter(Boolean).join(' - ');
}

function sessionWhen(s: ApiOpenPlaySession): string {
  const day = prettyDate(s.date);
  const time = timeRange(s);
  if (day && time) return `${day} · ${time}`;
  return day || time || 'Schedule TBA';
}

export function OpenPlayDetailScreen({ source, id, chrome, onBack }: Props) {
  if (source === 'auto') return <AutoOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
  if (source === 'game') {
    return <GameDetailsScreen gameId={id} onNavigate={chrome.onNavigate} onBack={onBack} onRequireAuth={chrome.requireAuth} />;
  }
  return <OrganizerOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
}

function AutoOpenPlayDetail({ id, chrome, onBack }: { id: string; chrome: V2ScreenChrome; onBack: () => void }) {
  const [kind, setKind] = useState<'loading' | 'game' | 'session'>('loading');

  useEffect(() => {
    let alive = true;
    setKind('loading');
    getGame(id)
      .then(() => { if (alive) setKind('game'); })
      .catch(() => { if (alive) setKind('session'); });
    return () => { alive = false; };
  }, [id]);

  if (kind === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (kind === 'game') return <GameDetailsScreen gameId={id} onNavigate={chrome.onNavigate} onBack={onBack} onRequireAuth={chrome.requireAuth} />;
  return <OrganizerOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
}

function OrganizerOpenPlayDetail({ id, chrome, onBack }: { id: string; chrome: V2ScreenChrome; onBack: () => void }) {
  const [session, setSession] = useState<ApiOpenPlaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getOpenPlaySession(id)
      .then((row) => { if (alive) setSession(row); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this Open Play session.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const joined = !!(session?.myRegistrationStatus === 'registered');
  const waitlisted = session?.myRegistrationStatus === 'waitlisted';
  const cap = session?.capacity ?? 0;
  const joinedCount = session?.joinedCount ?? 0;
  const spotsLeft = cap > 0 ? Math.max(0, cap - joinedCount) : 0;
  const isFull = cap > 0 && spotsLeft <= 0;

  const toggleJoin = async () => {
    if (!session || busy) return;
    if (!joined && !chrome.requireAuth('join Open Play')) return;
    setBusy(true);
    setError(null);
    try {
      if (joined) {
        await leaveOpenPlaySession(session.id);
        setSession({
          ...session,
          myRegistrationStatus: null,
          joinedCount: Math.max(0, joinedCount - 1),
        });
      } else {
        const res = await joinOpenPlaySession(session.id);
        setSession({
          ...session,
          myRegistrationStatus: res.status,
          joinedCount: res.status === 'registered' ? joinedCount + 1 : joinedCount,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your Open Play spot.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="scroll safe-top safe-bottom">
        <div className="detail-hero" style={{ minHeight: 140 }}>
          <div className="img bg-[linear-gradient(135deg,#0040e0_0%,#6c83ff_60%,#a5b9ff_100%)]" />
          <div className="grad" />
          <div className="top-controls">
            <button className="icon-btn" onClick={onBack} aria-label="Back">
              <Icon name="back" size={18} />
            </button>
          </div>
        </div>
        <EmptyState icon="calendar" title="Open Play not found" description={error || 'This session may have been cancelled.'} action={{ label: 'Back to Open Play', onPress: onBack }} />
      </div>
    );
  }

  return (
    <div className="scroll pb-[130px]">
      {/* ── Hero ── */}
      <div className="detail-hero">
        <div className="img bg-[linear-gradient(135deg,#0040e0_0%,#6c83ff_60%,#a5b9ff_100%)]" />
        <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
          <CourtIllustration width={240} />
        </div>
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
        </div>
        <div className="info">
          <div className="tag-row">
            {session.levelLabel && <span className="tag lime">{session.levelLabel}</span>}
            <span className="tag">Open Play</span>
          </div>
          <h1>{session.title || 'Open Play'}</h1>
          <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={14} /> {sessionWhen(session)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} /> {session.venueName || 'Venue TBA'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="detail-body">
        {/* KV grid */}
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Level</div>
            <div className="val">{session.levelLabel || 'All levels'}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Price</div>
            <div className="val">{money(Number(session.price ?? 0), 'PHP')}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Spots</div>
            <div className={`val ${spotsLeft > 0 ? 'lime' : ''}`}>
              {cap > 0 ? `${joinedCount}/${cap} joined` : `${joinedCount} joined`}
            </div>
          </div>
        </div>

        {/* Organizer card */}
        {session.organizerName && (
          <div className="organizer">
            <div className="meta" style={{ flex: 1 }}>
              <div className="role">Organized by</div>
              <div className="name">{session.organizerName}</div>
            </div>
          </div>
        )}

        {/* Location card */}
        <div className="location-card">
          <div className="map-preview">
            <div className="pin">
              <Icon name="location" size={16} />
            </div>
          </div>
          <div className="map-info">
            <div className="text">
              <div className="name">{session.venueName || 'Venue TBA'}</div>
            </div>
            {session.venueName && (
              <a
                className="directions"
                aria-label="Get directions"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.venueName)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="directions" size={18} />
              </a>
            )}
          </div>
        </div>

        {/* About */}
        <div className="about-card">
          <div className="t-eyebrow mb-1.5">About this session</div>
          {session.description ? (
            <p>{session.description}</p>
          ) : (
            <p>
              Open Play session{ session.levelLabel ? ` · ${session.levelLabel}` : ''}
              {session.venueName ? ` at ${session.venueName}` : ''}.
            </p>
          )}
          <p>
            {joinedCount} going
            {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} still open` : ' · this session is full'}.
          </p>
        </div>

        {/* Spots summary */}
        <div className="mb-[18px]">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="t-eyebrow">Players</div>
              <div className="hd-3 mt-1">
                {joinedCount} going{spotsLeft > 0 ? ` · ${spotsLeft} spots open` : ''}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3 mb-4">
            <div className="text-[13px] font-bold text-[var(--coral)]">{error}</div>
          </div>
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-cta">
        <div className="price">
          <div className="eyebrow">{joined ? 'Your spot' : 'Open spots'}</div>
          <div className="amount">{joined ? "You're in" : spotsLeft > 0 ? spotsLeft : 'Full'}</div>
        </div>
        {joined ? (
          <button className="btn-join btn-leave" onClick={toggleJoin} disabled={busy}>
            {busy ? (
              <>
                <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                Leaving…
              </>
            ) : (
              <>
                <Icon name="logout" size={16} />
                Leave Open Play
              </>
            )}
          </button>
        ) : waitlisted ? (
          <button className="btn-join joined" disabled>
            <Icon name="clock" size={16} />
            Waitlisted
          </button>
        ) : (
          <button className="btn-join" onClick={toggleJoin} disabled={busy || isFull}>
            {busy ? (
              <>
                <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                Joining…
              </>
            ) : isFull ? (
              'Session full'
            ) : (
              <>
                <Icon name="bolt" size={16} />
                Join Open Play
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
