import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { crossSearch, startConversation, type CrossSearchResults, type SearchResult } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { useDemandTracking } from '../../shared/hooks/useDemandTracking';
import type { Navigate } from '../../shared/lib/navigation';

interface SearchScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const ICONS: Record<SearchResult['kind'], string> = {
  court: 'location',
  game: 'paddle',
  club: 'groups',
  player: 'user',
};

const TONE: Record<SearchResult['kind'], string> = {
  court: 'bg-[var(--lime)] text-[var(--lime-ink)]',
  game: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]',
  club: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  player: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]',
};

// Section order + headings for the grouped results.
const SECTIONS: Array<{ key: keyof CrossSearchResults; label: string }> = [
  { key: 'courts', label: 'Courts' },
  { key: 'games', label: 'Games' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'players', label: 'Players' },
];

const RECENTS_KEY = 'pb-recent-searches';
const RECENTS_MAX = 6;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string').slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

const EMPTY_RESULTS: CrossSearchResults = { courts: [], games: [], clubs: [], players: [] };

export function SearchScreen({ onNavigate, onBack }: SearchScreenProps) {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { trackSearch } = useDemandTracking();
  // Browse aid like Nearby: open to guests; for signed-in users it's gated by
  // the search capability so accounts can have it withheld.
  const canSearch = !isLoggedIn || userHasPermission(user, 'player.search.use');
  const canMessage = isLoggedIn && userHasPermission(user, 'user.messages.send');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CrossSearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recents, setRecents] = useState<string[]>(loadRecents);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const total = results.courts.length + results.games.length + results.clubs.length + results.players.length;

  // Debounced live search. A monotonically increasing request id discards
  // out-of-order responses so the visible results always match the latest query.
  const reqId = useRef(0);
  const runSearch = useCallback(async (q: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const res = await crossSearch(q);
      if (id === reqId.current) {
        setResults(res);
        // Demand signal: record search when results are non-empty.
        const total = res.courts.length + res.games.length + res.clubs.length + res.players.length;
        if (total > 0) trackSearch(q);
      }
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [trackSearch]);

  const [prevSearchKey, setPrevSearchKey] = useState(`${trimmed}|${hasQuery}|${canSearch}`);
  const searchKey = `${trimmed}|${hasQuery}|${canSearch}`;
  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey);
    if (!hasQuery || !canSearch) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setError(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!hasQuery || !canSearch) {
      reqId.current++; // cancel any in-flight result
      return;
    }
    const t = setTimeout(() => runSearch(trimmed), 300);
    return () => clearTimeout(t);
  }, [trimmed, hasQuery, canSearch, runSearch]);

  function rememberRecent(term: string) {
    const next = [term, ...recents.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENTS_MAX);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch { /* storage unavailable — recents are best-effort */ }
  }

  function clearRecents() {
    setRecents([]);
    try {
      localStorage.removeItem(RECENTS_KEY);
    } catch { /* ignore */ }
  }

  async function openResult(item: SearchResult) {
    if (trimmed) rememberRecent(trimmed);
    if (item.kind === 'court') return onNavigate('court-details', { id: item.id });
    if (item.kind === 'game') return onNavigate('game-details', { id: item.id });
    if (item.kind === 'club') return onNavigate('club-details', { id: item.id });
    // Player → open (or start) a direct conversation. Only when messaging is
    // available; otherwise the row is inert (guests / accounts without the perm).
    if (!canMessage) return;
    try {
      const conv = await startConversation(item.id);
      onNavigate('chat', { id: conv.id, name: item.name });
    } catch { /* best-effort — leave the user on search if it fails */ }
  }

  const emptyState = (
    <EmptyState
      icon="search"
      title="No matches"
      description={`Nothing for "${trimmed}". Try a different keyword.`}
    />
  );

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <div className="px-4 pt-1 pb-3.5 flex items-center gap-2.5">
        <div className="searchbar m-0! flex-1">
          <Icon name="search" size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courts, games, clubs, players…"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <button onClick={onBack} className="text-[var(--primary)] font-bold text-[13px]">
          Cancel
        </button>
      </div>

      {!canSearch ? (
        <EmptyState
          icon="search"
          title="Search isn't available"
          description="Your account doesn't have access to search right now."
        />
      ) : !hasQuery ? (
        recents.length > 0 && (
          <div className="section mt-1!">
            <div className="section-head">
              <div className="hd-2">Recent</div>
              <button onClick={clearRecents} className="text-[var(--primary)] font-bold text-[12px]">
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {recents.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-left cursor-pointer"
                >
                  <Icon name="clock" size={16} className="text-[var(--muted)]" />
                  <span className="text-[var(--ink)] text-[14px] font-semibold">{term}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <DemoBranch
          loading={
            <div className="px-5">
              <LoadingSkeleton variant="list-row" count={5} />
            </div>
          }
          error={
            <ErrorState
              title="Search unavailable"
              message="We couldn't reach the search index right now. Try again in a moment."
              onRetry={() => runSearch(trimmed)}
            />
          }
          empty={emptyState}
        >
          {loading ? (
            <div className="px-5">
              <LoadingSkeleton variant="list-row" count={5} />
            </div>
          ) : error ? (
            <ErrorState
              title="Search unavailable"
              message="We couldn't reach the search index right now. Try again in a moment."
              onRetry={() => runSearch(trimmed)}
            />
          ) : total === 0 ? (
            emptyState
          ) : (
            SECTIONS.map(({ key, label }) => {
              const items = results[key];
              if (!items.length) return null;
              return (
                <div key={key} className="section">
                  <div className="section-head">
                    <div className="hd-2">{label}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <button
                        key={`${item.kind}-${item.id}`}
                        className="organizer m-0! cursor-pointer"
                        onClick={() => openResult(item)}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${TONE[item.kind]}`}>
                          <Icon name={ICONS[item.kind]} size={18} />
                        </div>
                        <div className="meta">
                          <div className="role">{item.kind}</div>
                          <div className="name">{item.name}</div>
                          <div className="t-sm mt-0.5">{item.subtitle}</div>
                        </div>
                        <Icon name="chevron" size={16} className="text-[var(--surface-3)]" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </DemoBranch>
      )}
    </div>
  );
}
