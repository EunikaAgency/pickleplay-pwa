import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { listClubs, type ApiClub } from '../../shared/lib/api';

interface ClubsScreenProps {
  onNavigate: Navigate;
  onBack?: () => void;
}

/** Case-insensitive name/description filter (module-level so it's not an effect/memo dep). */
function matchClubs(list: ApiClub[], q: string): ApiClub[] {
  return q ? list.filter((c) => `${c.name} ${c.description ?? ''}`.toLowerCase().includes(q)) : list;
}

function ClubRow({ club, onTap }: { club: ApiClub; onTap: () => void }) {
  const meta = `${club.memberCount} member${club.memberCount === 1 ? '' : 's'}${club.visibility === 'private' ? ' · private' : ''}`;
  return (
    <button className="club-card" onClick={onTap}>
      <div
        className="icon-circle blue overflow-hidden"
        style={club.coverImageUrl ? { backgroundImage: `url(${club.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!club.coverImageUrl && <Icon name="groups" size={22} />}
      </div>
      <div className="body">
        <div className="name">{club.name}</div>
        <div className="meta">
          <Icon name="groups" size={12} />
          {meta}
        </div>
      </div>
      <Icon name="chevron" size={18} className="text-[var(--surface-3)]" />
    </button>
  );
}

export function ClubsScreen({ onNavigate }: ClubsScreenProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [mine, setMine] = useState<ApiClub[]>([]);
  const [discover, setDiscover] = useState<ApiClub[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      isLoggedIn ? listClubs({ mine: true }).catch(() => [] as ApiClub[]) : Promise.resolve([] as ApiClub[]),
      listClubs(),
    ])
      .then(([myClubs, all]) => {
        if (!alive) return;
        setMine(myClubs);
        const mineIds = new Set(myClubs.map((c) => c.id));
        setDiscover(all.filter((c) => !mineIds.has(c.id)));
        setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [isLoggedIn, reloadKey]);

  const retry = () => { setStatus('loading'); setReloadKey((k) => k + 1); };

  const q = query.trim().toLowerCase();
  const myFiltered = useMemo(() => matchClubs(mine, q), [mine, q]);
  const discoverFiltered = useMemo(() => matchClubs(discover, q), [discover, q]);

  const header = (
    <>
      <div className="app-header">
        <div>
          <div className="greet-name">Clubs</div>
          <div className="greet-sub">Find your people</div>
        </div>
        <button
          onClick={() => onNavigate('create-club')}
          className="h-10 px-3.5 rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold flex items-center gap-1.5"
        >
          <Icon name="plus" size={14} /> New
        </button>
      </div>
      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search clubs by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
    </>
  );

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="section mt-4!"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return (
      <div className="scroll safe-top safe-bottom">
        {header}
        <ErrorState title="Couldn't load clubs" message="We couldn't reach the clubs directory. Tap to retry." onRetry={retry} />
      </div>
    );
  }

  const nothing = myFiltered.length === 0 && discoverFiltered.length === 0;

  return (
    <div className="scroll safe-top safe-bottom">
      {header}

      {nothing ? (
        <EmptyState
          icon="groups"
          title={q ? 'No clubs match your search' : 'No clubs yet'}
          description={q ? 'Try a different name.' : 'Be the first to start a community — PickleBallers grows when locals organize regular play.'}
          action={q ? undefined : { label: 'Start a club', onPress: () => onNavigate('create-club') }}
        />
      ) : (
        <>
          {myFiltered.length > 0 && (
            <div className="section">
              <div className="section-head">
                <div>
                  <div className="t-eyebrow">My clubs</div>
                  <div className="hd-2 mt-1">You're a member of {mine.length}</div>
                </div>
              </div>
              <div className="clubs-grid flex flex-col gap-2.5">
                {myFiltered.map((c) => (
                  <ClubRow key={c.id} club={c} onTap={() => onNavigate('club-details', { id: c.slug || c.id })} />
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Discover</div>
                <div className="hd-2 mt-1">Clubs to join</div>
              </div>
            </div>
            {discoverFiltered.length === 0 ? (
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">
                {q ? 'No other clubs match your search.' : "You've joined every club so far — start a new one!"}
              </div>
            ) : (
              <div className="clubs-grid flex flex-col gap-2.5">
                {discoverFiltered.map((c) => (
                  <ClubRow key={c.id} club={c} onTap={() => onNavigate('club-details', { id: c.slug || c.id })} />
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <button
              className="featured-club border-none cursor-pointer bg-[linear-gradient(135deg,var(--lime-soft),var(--lime))]! text-[var(--lime-ink)]!"
              onClick={() => onNavigate('create-club')}
            >
              <span className="eyebrow bg-[var(--ink)]! text-white!">START YOUR OWN</span>
              <h3 className="text-[var(--lime-ink)]!">Can't find your crew?</h3>
              <p className="text-[rgba(42,55,0,0.7)]!">Start a club, invite friends, and own your weekly mixer.</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
