import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import {
  listConversations,
  searchPlayers,
  startConversation,
  deleteConversation,
  type ApiConversationSummary,
  type ApiPlayer,
} from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';
import type { Navigate } from '../../shared/lib/navigation';

interface ConversationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

/** Short relative time for a conversation's last activity. */
function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ConversationsScreen({ onNavigate, onBack }: ConversationsScreenProps) {
  const [items, setItems] = useState<ApiConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // "New message": search any player by name and open (or create) a thread with
  // them — so you can message someone even if you've never met them in a game.
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listConversations()
      .then((rows) => { if (alive) setItems(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load messages.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Realtime: an incoming message changes a thread's last-message / unread /
  // ordering — reload the list so it reflects the new activity immediately.
  useEffect(() => onRealtime('message', () => setReloadKey((k) => k + 1)), []);

  // Debounced people search while composing. A blank/short query clears results.
  const reqId = useRef(0);
  useEffect(() => {
    if (!composing) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]); setSearched(false); setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchPlayers(q);
        if (id === reqId.current) { setResults(found); setSearched(true); }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, composing]);

  const openCompose = () => { setComposing(true); setQuery(''); setResults([]); setSearched(false); };
  const closeCompose = () => { setComposing(false); setQuery(''); setResults([]); setSearched(false); };

  const removeConv = async (c: ApiConversationSummary) => {
    if (!window.confirm('Delete this conversation? It will come back if they message you again.')) return;
    setItems((prev) => prev.filter((x) => x.id !== c.id)); // optimistic
    try {
      await deleteConversation(c.id);
    } catch {
      setReloadKey((k) => k + 1); // restore from server on failure
    }
  };

  const startWith = async (p: ApiPlayer) => {
    if (starting) return;
    setStarting(true);
    try {
      const conv = await startConversation(p.id);
      closeCompose();
      onNavigate('chat', { id: conv.id, name: p.displayName });
    } catch {
      setStarting(false);
    }
  };

  if (composing) {
    return (
      <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={closeCompose} backIcon="close" title="New message" />
        <div className="section mt-1!">
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <Icon name="search" size={18} />
            </span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players by name…"
              className="w-full h-12 rounded-[12px] bg-[var(--surface-2)] pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {query.trim().length < 2 ? (
            <p className="t-sm px-1">Type at least 2 letters to find a player.</p>
          ) : searching ? (
            <LoadingSkeleton variant="list-row" count={4} />
          ) : searched && results.length === 0 ? (
            <EmptyState icon="search" title="No players found" description="Try a different name." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="organizer m-0! disabled:opacity-50"
                  disabled={starting}
                  onClick={() => startWith(p)}
                >
                  <Avatar src={p.avatarUrl} name={p.displayName} size={44} />
                  <div className="meta min-w-0">
                    <div className="name truncate">{p.displayName}</div>
                    <div className="t-sm truncate">
                      {p.skillLevel != null ? `DUPR ${p.skillLevel}` : p.skillLevelLabel ?? 'Player'}
                    </div>
                  </div>
                  <Icon name="message" size={18} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Messages"
        action={
          <button
            type="button"
            aria-label="New message"
            onClick={openCompose}
            className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center"
          >
            <Icon name="edit" size={18} />
          </button>
        }
      />

      <div className="section mt-1!">
        {loading ? (
          <LoadingSkeleton variant="list-row" count={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="chat"
            title="No messages yet"
            description="Tap the compose button to message any player — or use “Message organizer” on any game."
            action={{ label: 'New message', onPress: openCompose }}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((c) => {
              const name = c.otherParticipant?.displayName ?? 'Player';
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="organizer m-0! cursor-pointer"
                  onClick={() => onNavigate('chat', { id: c.id, name })}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('chat', { id: c.id, name }); }}
                >
                  <Avatar src={c.otherParticipant?.avatarUrl} name={name} size={44} />
                  <div className="meta min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="name truncate">{name}</div>
                      <div className="t-sm shrink-0">{timeAgo(c.lastAt)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`t-sm truncate ${c.unread > 0 ? 'font-bold text-[var(--ink)]' : ''}`}>
                        {c.lastBody || 'No messages yet'}
                      </div>
                      {c.unread > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--coral)] text-white text-[11px] font-extrabold leading-5 text-center">
                          {c.unread > 9 ? '9+' : c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete conversation with ${name}`}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--coral)]"
                    onClick={(e) => { e.stopPropagation(); removeConv(c); }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
