import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { GameDetailsScreen } from '../GameDetailsScreen';
import {
  getOpenPlaySession, joinOpenPlaySession, leaveOpenPlaySession,
  type ApiOpenPlaySession,
} from '../../../shared/lib/api';
import { money, prettyDate, to12h } from '../../bookings/bookingDisplay';

interface Props {
  source: 'game' | 'session';
  id: string;
  chrome: V2ScreenChrome;
  onBack: () => void;
}

function timeRange(s: ApiOpenPlaySession): string {
  const start = s.startTime ? to12h(s.startTime) : '';
  const end = s.endTime ? to12h(s.endTime) : '';
  return [start, end].filter(Boolean).join(' - ');
}

function spots(s: ApiOpenPlaySession): string {
  const joined = s.joinedCount ?? 0;
  const cap = s.capacity ?? 0;
  return cap > 0 ? joined + '/' + cap + ' joined' : joined + ' joined';
}

export function OpenPlayDetailScreen({ source, id, chrome, onBack }: Props) {
  if (source === 'game') {
    return <GameDetailsScreen gameId={id} onNavigate={chrome.onNavigate} onBack={onBack} onRequireAuth={chrome.requireAuth} />;
  }
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

  const joined = !!session?.myRegistrationStatus;
  const joinLabel = session?.myRegistrationStatus === 'waitlisted' ? 'Waitlisted' : joined ? 'Leave Open Play' : 'Join Open Play';

  const toggleJoin = async () => {
    if (!session || busy) return;
    if (!joined && !chrome.requireAuth('join Open Play')) return;
    setBusy(true);
    setError(null);
    try {
      if (joined) {
        const wasRegistered = session.myRegistrationStatus === 'registered';
        await leaveOpenPlaySession(session.id);
        setSession({
          ...session,
          myRegistrationStatus: null,
          joinedCount: wasRegistered ? Math.max(0, (session.joinedCount ?? 0) - 1) : session.joinedCount,
        });
      } else {
        const res = await joinOpenPlaySession(session.id);
        setSession({
          ...session,
          myRegistrationStatus: res.status,
          joinedCount: res.status === 'registered' ? (session.joinedCount ?? 0) + 1 : session.joinedCount,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your Open Play spot.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <V2Shell screen="v2-openplay-detail" chrome={chrome} onBack={onBack} hideFab hideTabBar>
      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="empty-icon-ring">...</div><h3>Loading Open Play</h3></div>
        ) : !session ? (
          <EmptyState icon="calendar" title="Open Play not found" description={error || 'This session may have been cancelled.'} action={{ label: 'Back to Open Play', onPress: onBack }} />
        ) : (
          <>
            <div className="games-intro">
              <h1 className="games-heading">{session.title || 'Open Play'}</h1>
              <p className="games-subheading">{[prettyDate(session.date), timeRange(session), session.venueName].filter(Boolean).join(' - ')}</p>
            </div>

            <section className="form-card">
              <div className="booked-court">
                <div className="booked-court-badge">Open Play</div>
                <div className="booked-court-name">{session.venueName || 'Venue TBA'}</div>
                <div className="booked-court-meta">
                  {[prettyDate(session.date), timeRange(session), session.levelLabel, spots(session)].filter(Boolean).join(' - ')}
                </div>
              </div>

              <div className="grid gap-3 mt-4">
                <div className="game-meta-row"><strong>Price:</strong> {money(Number(session.price ?? 0), 'PHP')}</div>
                <div className="game-meta-row"><strong>Status:</strong> {session.status || 'published'}</div>
                {session.organizerName && <div className="game-meta-row"><strong>Organizer:</strong> {session.organizerName}</div>}
              </div>

              {session.description && <p className="page-hero-sub" style={{ color: 'var(--text-secondary)', marginTop: 14 }}>{session.description}</p>}
              {error && <div className="vis-help" style={{ color: 'var(--warning)' }} role="alert">{error}</div>}
            </section>

            <div className="submit-wrap">
              <Button fullWidth variant={joined ? 'outline' : 'dark'} onClick={toggleJoin} disabled={busy || session.myRegistrationStatus === 'waitlisted'}>
                {busy ? 'Saving...' : joinLabel}
              </Button>
              {session.myRegistrationStatus === 'waitlisted' && <div className="submit-help">You are on the waitlist for this session.</div>}
            </div>
          </>
        )}
      </div>
    </V2Shell>
  );
}
