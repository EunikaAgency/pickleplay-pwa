import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import {
  getTournament, getMyTournamentRegistration, registerForTournament, withdrawFromTournament,
  getTournamentAnnouncements, apiImageUrl,
  type ApiTournament, type ApiAnnouncement,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import type { Navigate } from '../../../shared/lib/navigation';
import { statusMeta, typeLabel, formatLabel, money, dateRange, prettyDate } from '../tournamentDisplay';

interface TournamentDetailScreenProps {
  tournamentId: string;
  onNavigate: Navigate;
  onBack: () => void;
  /** Soft auth gate — returns false (and prompts sign-up) for guests. */
  onRequireAuth?: (intent: string) => boolean;
}

type MyReg = { id: string; status: string } | null;

// How a player's registration state reads on the action button / banner.
function regCopy(status: string): { label: string; tone: string } {
  switch (status) {
    case 'registered': return { label: 'You’re registered', tone: 'ok' };
    case 'waitlisted': return { label: 'On the waitlist', tone: 'warn' };
    case 'pending': return { label: 'Awaiting organizer approval', tone: 'warn' };
    default: return { label: 'Registered', tone: 'ok' };
  }
}

export function TournamentDetailScreen({ tournamentId, onNavigate, onBack, onRequireAuth }: TournamentDetailScreenProps) {
  const me = useAuthStore((s) => s.user);
  const canJoin = userHasPermission(me, 'player.tournaments.join');
  const canChat = userHasPermission(me, 'player.tournaments.chat');

  const [t, setT] = useState<ApiTournament | null>(null);
  const [myReg, setMyReg] = useState<MyReg>(null);
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getTournament(tournamentId)
      .then(async (tour) => {
        if (!alive) return;
        setT(tour);
        if (me) {
          const reg = await getMyTournamentRegistration(tournamentId).catch(() => null);
          if (alive) setMyReg(reg);
          if (alive && reg) {
            const feed = await getTournamentAnnouncements(tournamentId).catch(() => []);
            if (alive) setAnnouncements(feed);
          }
        }
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this tournament.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId, reloadKey, me]);

  const register = async () => {
    if (!me) { onRequireAuth?.('register for this tournament'); return; }
    setActing(true);
    setActionError(null);
    try {
      const reg = await registerForTournament(tournamentId);
      setMyReg(reg);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not register. Try again.');
    } finally {
      setActing(false);
    }
  };

  const withdraw = async () => {
    setActing(true);
    setActionError(null);
    try {
      await withdrawFromTournament(tournamentId);
      setMyReg(null);
      setAnnouncements([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not withdraw. Try again.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} title="Tournament" />
        <div className="px-5"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (error || !t) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} title="Tournament" />
        <div className="px-5"><ErrorState message={error ?? 'Not found.'} onRetry={() => setReloadKey((k) => k + 1)} /></div>
      </div>
    );
  }

  const meta = statusMeta(t.status);
  const banner = apiImageUrl(t.bannerUrl);
  const taken = Number(t.registeredPlayers ?? t.registeredCount ?? 0);
  const cap = Number(t.maxPlayers ?? 0);
  const full = cap > 0 && taken >= cap;
  // `open` is the legacy seed equivalent of `registration_open`.
  const isOpen = t.status === 'registration_open' || t.status === 'open';
  const details: { label: string; value: string }[] = [
    { label: 'Type', value: typeLabel(t) },
    { label: 'Skill', value: t.skillLevel || 'All levels' },
    { label: 'Format', value: formatLabel(t.format) || '—' },
    { label: 'Entry', value: money(t.price) },
  ];

  return (
    <div className="scroll pb-[120px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title={t.name} eyebrow="Tournament" />

      <div className="px-5 flex flex-col gap-4">
        {/* Banner */}
        <div
          className="rounded-2xl overflow-hidden h-40 flex items-center justify-center text-white"
          style={banner
            ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'linear-gradient(135deg, var(--primary), #2E5BFF)' }}
        >
          {!banner && <Icon name="trophy" size={48} />}
        </div>

        {/* Title + status */}
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading font-semibold text-[18px] text-[var(--ink)]">{t.name}</div>
              <div className="t-sm mt-0.5 flex items-center gap-1">
                <Icon name="calendar" size={14} /> {dateRange(t)}
              </div>
              {t.venueName && (
                <div className="t-sm mt-0.5 flex items-center gap-1">
                  <Icon name="map_pin" size={14} /> {t.venueName}
                </div>
              )}
            </div>
            <span className={`tt-badge tt-badge--${meta.tone} shrink-0`}>{meta.label}</span>
          </div>
          {t.description && <p className="t-sm mt-3 whitespace-pre-line leading-relaxed">{t.description}</p>}
        </div>

        {/* Quick facts */}
        <div className="card p-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {details.map((d) => (
            <div key={d.label}>
              <div className="t-eyebrow">{d.label}</div>
              <div className="font-heading font-bold text-[14px] text-[var(--ink)] leading-tight mt-0.5">{d.value}</div>
            </div>
          ))}
        </div>

        {/* Capacity */}
        {cap > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="t-sm flex items-center gap-1"><Icon name="groups" size={15} /> Registered</span>
              <span className="font-heading font-bold text-[var(--ink)]">{taken} / {cap}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, cap ? (taken / cap) * 100 : 0)}%` }} />
            </div>
          </div>
        )}

        {/* Registration banner + action */}
        {myReg ? (
          <div className="flex flex-col gap-2">
            <div className={`tt-reg-banner tt-reg-banner--${regCopy(myReg.status).tone}`}>
              <Icon name="check" size={16} /> {regCopy(myReg.status).label}
            </div>
            {canChat && (
              <Button fullWidth variant="brand" onClick={() => onNavigate('tournament-chat', { id: tournamentId, name: t.name })}>
                <Icon name="chat" size={16} /> Tournament chat
              </Button>
            )}
            <Button fullWidth variant="outline" onClick={withdraw} disabled={acting}>
              {acting ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </div>
        ) : isOpen ? (
          <Button fullWidth onClick={register} disabled={acting || (full && !t.allowWaitlist) || (!!me && !canJoin)}>
            {acting ? 'Registering…'
              : !me ? 'Sign in to register'
              : !canJoin ? 'Not eligible to register'
              : full ? (t.allowWaitlist ? 'Join the waitlist' : 'Tournament full')
              : 'Register'}
          </Button>
        ) : (
          <div className="tt-reg-banner tt-reg-banner--muted">
            {t.status === 'approved'
              ? `Registration opens ${prettyDate(t.registrationOpenDate) || 'soon'}`
              : t.status === 'ongoing' ? 'Tournament in progress'
              : t.status === 'completed' ? 'This tournament has ended'
              : 'Registration is not open'}
          </div>
        )}
        {actionError && <div className="text-[13px] font-semibold text-[var(--coral)]">{actionError}</div>}

        {/* Prizes */}
        {(t.prizeChampion || t.prizeRunnerUp || t.prizeThird) && (
          <div className="card p-4">
            <div className="font-heading font-semibold text-[15px] text-[var(--ink)] mb-2 flex items-center gap-1.5">
              <Icon name="trophy" size={16} /> Prizes
            </div>
            <div className="flex flex-col gap-1.5 t-sm">
              {t.prizeChampion && <div>🥇 Champion · {t.prizeChampion}</div>}
              {t.prizeRunnerUp && <div>🥈 Runner-up · {t.prizeRunnerUp}</div>}
              {t.prizeThird && <div>🥉 Third · {t.prizeThird}</div>}
            </div>
          </div>
        )}

        {/* Rules */}
        {t.rules && (
          <div className="card p-4">
            <div className="font-heading font-semibold text-[15px] text-[var(--ink)] mb-1.5">Rules</div>
            <p className="t-sm whitespace-pre-line leading-relaxed">{t.rules}</p>
          </div>
        )}

        {/* Announcements (registrants only) */}
        {myReg && announcements.length > 0 && (
          <div className="card p-4">
            <div className="font-heading font-semibold text-[15px] text-[var(--ink)] mb-2 flex items-center gap-1.5">
              <Icon name="bell" size={16} /> Announcements
            </div>
            <div className="flex flex-col gap-2.5">
              {announcements.map((a) => (
                <div key={a.id} className="pb-2.5 border-b-[0.5px] border-[var(--hairline)] last:border-0 last:pb-0">
                  <div className="font-semibold text-[14px] text-[var(--ink)]">{a.title}</div>
                  <p className="t-sm mt-0.5 whitespace-pre-line">{a.body}</p>
                  <div className="t-eyebrow mt-1">{prettyDate(a.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizer contact */}
        {(t.organizerName || t.contactEmail) && (
          <div className="t-sm text-center">
            Organized by {t.organizerName || 'the host'}{t.contactEmail ? ` · ${t.contactEmail}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
