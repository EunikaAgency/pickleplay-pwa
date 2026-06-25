import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { listPublicTournaments, listMyTournaments, listMyTournamentRegistrations, apiImageUrl, type ApiTournament } from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { statusMeta, typeLabel, money, dateRange } from '../tournamentDisplay';

/* Player Tournament tab — three role-aware tabs over the public tournaments an
 * organizer has announced (mirrors the web `/tournaments` discovery surface in
 * the v2.1 player chrome). Tapping a card opens the player detail (register/
 * withdraw) — except an organizer's own events, which open the organizer console.
 *
 * The middle tab changes by role (it replaces the old public "Upcoming" list):
 *   Open      — events open for registration that I'm not already part of.
 *               Organizers: ones they DON'T run. Players/coaches: ones they
 *               haven't joined.
 *   Managing  — (organizers) the tournaments they run that haven't finished —
 *               their active management shortlist.
 *   Joined    — (players/coaches) the active tournaments they've registered for.
 *   Results   — *personal*, not a public archive: the finished events the user
 *               was part of — ones they hosted (listMyTournaments) plus ones
 *               they joined (listMyTournamentRegistrations).
 *
 * `open` is the legacy seed equivalent of `registration_open`; `closed` of a
 * finished/ended event. */

type Tab = 'open' | 'mine' | 'results';

function isOpenForReg(t: ApiTournament): boolean {
  return t.status === 'registration_open' || t.status === 'open';
}
function isFinished(t: ApiTournament): boolean {
  return t.status === 'completed' || t.status === 'closed';
}

// Only surface publicly-discoverable tournaments (hide private / invite-only).
function isDiscoverable(t: ApiTournament): boolean {
  return !t.visibility || t.visibility === 'public';
}

function spotsLabel(t: ApiTournament): string {
  const taken = Number(t.registeredPlayers ?? t.registeredCount ?? 0);
  const cap = Number(t.maxPlayers ?? 0);
  if (cap > 0) {
    const left = Math.max(0, cap - taken);
    return left > 0 ? `${left} spot${left === 1 ? '' : 's'} left` : 'Full';
  }
  return taken > 0 ? `${taken} registered` : 'Be the first';
}

export function TournamentsScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, isLoggedIn } = chrome;
  const me = useAuthStore((s) => s.user);
  // Organizers get a shortcut to spin up a tournament straight from the browse
  // tab (skips Profile → Organizer console). Players/coaches never see it.
  const canOrganize = userHasPermission(me, 'organizer.tournaments.manage');
  const [tab, setTab] = useState<Tab>('open');
  const [all, setAll] = useState<ApiTournament[]>([]);
  // The user's own tournaments (organizers only) — drives the Managing tab + the
  // hosted half of Results.
  const [mine, setMine] = useState<ApiTournament[]>([]);
  // IDs of every tournament the signed-in user has registered for — drives the
  // Joined tab and the "not already joined" exclusion on Open + Results.
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      listPublicTournaments(),
      // Hosted events come from the organizer's own tournaments; skip the call
      // (and its 403) for users who can't manage tournaments.
      canOrganize ? listMyTournaments().catch(() => [] as ApiTournament[]) : Promise.resolve([] as ApiTournament[]),
      // Which tournaments the signed-in user has joined — one call. Guests join none.
      isLoggedIn ? listMyTournamentRegistrations().catch(() => []) : Promise.resolve([] as { tournamentId: string; status: string }[]),
    ])
      .then(([pub, own, regs]) => {
        if (!alive) return;
        setAll(pub);
        setMine(own);
        setJoinedIds(new Set(regs.map((r) => r.tournamentId)));
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load tournaments.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey, canOrganize, isLoggedIn]);

  // IDs of tournaments the signed-in user organizes — used to badge their own
  // events in Results and to route their cards to the organizer console.
  const mineIds = useMemo(() => new Set(mine.map((t) => t.id)), [mine]);

  const visible = useMemo(() => {
    if (tab === 'results') {
      // Personal results: finished events I hosted + finished public ones I joined.
      const hosted = mine.filter(isFinished);
      const joinedPublic = all.filter(
        (t) => isDiscoverable(t) && isFinished(t) && joinedIds.has(t.id) && !mineIds.has(t.id),
      );
      // Past events read best newest-first.
      return [...hosted, ...joinedPublic].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    }
    if (tab === 'mine') {
      // Organizers: the tournaments I run that haven't finished (active shortlist).
      if (canOrganize) {
        return mine
          .filter((t) => !isFinished(t) && t.status !== 'cancelled')
          .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
      }
      // Players/coaches: active tournaments I've joined.
      return all
        .filter((t) => isDiscoverable(t) && joinedIds.has(t.id) && !isFinished(t))
        .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
    }
    // Open: events open for registration that I'm not already part of.
    return all
      .filter((t) => {
        if (!isDiscoverable(t) || !isOpenForReg(t)) return false;
        // Organizers: hide the ones I run. Players/coaches: hide the ones I've joined.
        return canOrganize ? !mineIds.has(t.id) : !joinedIds.has(t.id);
      })
      .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
  }, [all, mine, mineIds, joinedIds, tab, canOrganize]);

  const tabs: { value: Tab; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'mine', label: canOrganize ? 'Managing' : 'Joined' },
    { value: 'results', label: 'Results' },
  ];

  const emptyCopy =
    tab === 'open' ? 'No tournaments are open for registration right now. Check back soon!'
    : tab === 'mine'
      ? !isLoggedIn ? 'Sign in to see the tournaments you’re part of.'
        : canOrganize ? 'You’re not running any active tournaments yet. Create one to get started.'
        : 'You haven’t joined any tournaments yet — find one in the Open tab.'
    : !isLoggedIn ? 'Sign in to see tournaments you’ve hosted or joined.'
    : canOrganize ? 'Tournaments you host show up here once they wrap up.'
    : 'Tournaments you join show up here once they wrap up.';

  return (
    <V2Shell screen="v2-tournaments" chrome={chrome}>
      <div className="tt-page">
        <div className="tt-intro">
          <h1 className="tt-heading">Tournaments</h1>
          <p className="tt-subheading">Register with a partner, compete, climb the bracket.</p>
        </div>

        {canOrganize && (
          <div className="tt-organize-row">
            <button type="button" className="tt-organize" onClick={() => onNavigate('organizer-tournament-new')}>
              <span className="tt-organize-ic" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </span>
              <span className="tt-organize-tx">
                <strong>Create a tournament</strong>
                <small>Draft it, request a venue, open registration</small>
              </span>
              <svg className="tt-organize-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}

        <div className="tab-group-row">
          <div className="tab-group" role="tablist" aria-label="Tournament view">
            {tabs.map((t) => (
              <button
                key={t.value}
                className={`seg-btn${tab === t.value ? ' active' : ''}`}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <V2Skeleton variant="tournament-list" count={5} />
        ) : error ? (
          <div className="tt-empty">
            <div className="tt-empty-ring">⚠️</div>
            <h3>Couldn’t load tournaments</h3>
            <p>{error}</p>
            <button className="tt-empty-cta" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="tt-empty">
            <div className="tt-empty-ring">🏆</div>
            <h3>Nothing here yet</h3>
            <p>{emptyCopy}</p>
          </div>
        ) : (
          visible.map((t) => {
            const meta = statusMeta(t.status);
            const banner = apiImageUrl(t.bannerUrl);
            return (
              <a
                key={t.id}
                className={`tt-card${t.status === 'completed' || t.status === 'closed' ? ' is-past' : ''}`}
                role="button"
                onClick={() => onNavigate(mineIds.has(t.id) ? 'organizer-tournament' : 'tournament', { id: t.id })}
              >
                <div
                  className="tt-thumb"
                  style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                >
                  {!banner && (
                    <svg className="tt-thumb-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" />
                    </svg>
                  )}
                  {mineIds.has(t.id) && tab !== 'mine' && (
                    <span className="tt-mine" aria-label="You manage this tournament">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 17h18" /><path d="M5 17l-1.5-9 5 3.5L12 5l3.5 6.5 5-3.5L19 17" />
                      </svg>
                      Managing
                    </span>
                  )}
                  <span className={`tt-chip tt-chip--${meta.tone}`}>{meta.label}</span>
                </div>
                <div className="tt-body">
                  <div className="tt-title">{t.name || 'Tournament'}</div>
                  <div className="tt-meta">
                    <div className="tt-meta-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {dateRange(t)}
                    </div>
                    {t.venueName && (
                      <div className="tt-meta-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {t.venueName}
                      </div>
                    )}
                  </div>
                  <div className="tt-tags">
                    <span className="tt-tag tt-tag--type">{typeLabel(t)}</span>
                    {t.skillLevel && <span className="tt-tag">{t.skillLevel}</span>}
                    <span className="tt-tag tt-tag--fee">{money(t.price)}</span>
                    <span className="tt-tag tt-tag--spots">{spotsLabel(t)}</span>
                  </div>
                </div>
              </a>
            );
          })
        )}
      </div>
    </V2Shell>
  );
}
