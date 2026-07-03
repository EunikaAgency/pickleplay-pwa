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
  getOwnerPlayerSuggestions,
  startConversation,
  deleteConversation,
  type ApiConversationSummary,
  type ApiPlayer,
  type OwnerPlayerSuggestion,
} from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import type { Navigate } from '../../shared/lib/navigation';

interface ConversationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

/** Strip notification-metadata prefixes that leak into lastBody so the
 *  conversation preview shows the actual message, not "chat Sender — msg".
 *  Only strips " — " when a notification prefix was removed, so normal
 *  messages like "Got it — see you there" are left intact. */
const NOTIF_TYPE_PREFIXES = [
  'chat', 'forum', 'message', 'alert', 'game_full', 'game_open',
  'venue_membership_invite', 'venue_membership_removed',
  'booking_pending_approval', 'booking_approved',
];
function cleanPreview(body: string): string {
  let s = body;
  let stripped = false;
  for (const p of NOTIF_TYPE_PREFIXES) {
    if (s.startsWith(p + ' ')) { s = s.slice(p.length + 1); stripped = true; break; }
  }
  if (stripped) {
    const dash = s.indexOf(' — ');
    if (dash !== -1) s = s.slice(dash + 3);
  }
  return s || body;
}

/** Short relative time for a conversation's last activity, or a booking's age. */
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

/** Short booking date: "Jun 30" or "Jun 30, 2026" for past years. */
function prettyBookingDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** "HH:MM" → "3:00 PM". */
function to12h(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Consider a user "active" if their last activity was within this many minutes. */
const ACTIVE_WINDOW_MIN = 5;

function isActive(iso?: string | null): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) < ACTIVE_WINDOW_MIN * 60_000;
}

export function ConversationsScreen({ onNavigate, onBack }: ConversationsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const isOwner = userHasPermission(user, 'owner.access');
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

  // Owner suggestion list: pre-fetched when the owner opens the compose screen
  // so they can browse players who've interacted with their venues without typing.
  const [suggestions, setSuggestions] = useState<OwnerPlayerSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey);
  if (reloadKey !== prevReloadKey) {
    setPrevReloadKey(reloadKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
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
  // Owners filter their pre-loaded suggestion list locally instead of hitting the
  // API again. Non-owners use the global searchPlayers.
  const reqId = useRef(0);
  useEffect(() => {
    if (!composing) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]); setSearched(false); setSearching(false);
      return;
    }
    // Owner path: filter the already-loaded suggestions by name.
    if (isOwner) {
      setSearching(true);
      const id = ++reqId.current;
      const t = setTimeout(() => {
        const lower = q.toLowerCase();
        const filtered = suggestions.filter((s) =>
          s.displayName.toLowerCase().includes(lower),
        );
        if (id === reqId.current) {
          setResults(filtered.map((s) => ({ id: s.id, displayName: s.displayName, avatarUrl: s.avatarUrl })));
          setSearched(true);
          setSearching(false);
        }
      }, 300);
      return () => clearTimeout(t);
    }
    // Non-owner path: global API search.
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
  }, [query, composing, isOwner, suggestions]);

  const openCompose = () => {
    setComposing(true); setQuery(''); setResults([]); setSearched(false);
    // Owners: pre-load venue players so the suggestion list is ready right away.
    if (isOwner && user?.id) {
      setSuggestionsLoading(true);
      getOwnerPlayerSuggestions(user.id)
        .then((s) => setSuggestions(s))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false));
    }
  };
  const closeCompose = () => {
    setComposing(false); setQuery(''); setResults([]); setSearched(false);
    setSuggestions([]); setSuggestionsLoading(false);
  };

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

  // Start a conversation from an owner suggestion — scoped to the booking or venue.
  const startWithSuggestion = async (s: OwnerPlayerSuggestion) => {
    if (starting) return;
    setStarting(true);
    try {
      const context = s.latestBooking
        ? { contextType: 'booking' as const, contextId: s.latestBooking.bookingId }
        : s.memberVenueId
          ? { contextType: 'venue' as const, contextId: s.memberVenueId }
          : undefined;
      const conv = await startConversation(s.id, context);
      closeCompose();
      onNavigate('chat', { id: conv.id, name: s.displayName });
    } catch {
      setStarting(false);
    }
  };

  // The "Browse" list the owner sees before typing — players who've booked or
  // are members, with their most recent booking context displayed.
  const visibleSuggestions = isOwner
    ? (query.trim().length < 2 ? suggestions : suggestions.filter((s) =>
        s.displayName.toLowerCase().includes(query.trim().toLowerCase()),
      ))
    : [];

  if (composing) {
    const showOwnerSuggestions = isOwner && query.trim().length < 2;
    const showOwnerSearch = isOwner && query.trim().length >= 2;

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
              placeholder={isOwner ? 'Filter players by name…' : 'Search players by name…'}
              className="w-full h-12 rounded-[12px] bg-[var(--surface-2)] pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* ── Owner: suggestion list before typing ── */}
          {showOwnerSuggestions && (
            suggestionsLoading ? (
              <LoadingSkeleton variant="list-row" count={5} />
            ) : suggestions.length === 0 ? (
              <EmptyState icon="users" title="No players yet" description="Players who book or join your venues will appear here." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {suggestions.map((s) => {
                  const bk = s.latestBooking;
                  const active = isActive(s.lastActiveAt);
                  return (
                    <button
                      key={s.id}
                      className="organizer m-0! disabled:opacity-50"
                      disabled={starting}
                      onClick={() => startWithSuggestion(s)}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={s.avatarUrl} name={s.displayName} size={44} />
                        {s.lastActiveAt != null && (
                          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                        )}
                      </div>
                      <div className="meta min-w-0">
                        <div className="name truncate">{s.displayName}</div>
                        <div className="t-sm truncate">
                          {bk ? (
                            <span>
                              Booked {timeAgo(bk.createdAt)}
                              {bk.date ? ` · ${prettyBookingDate(bk.date)}` : ''}
                              {bk.startTime ? `, ${to12h(bk.startTime)}` : ''}
                            </span>
                          ) : (
                            'Member'
                          )}
                          {s.isMember && bk && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)]">
                              <Icon name="star" size={9} /> Member
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon name="message" size={18} />
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Owner: search filter results ── */}
          {showOwnerSearch && (
            searching ? (
              <LoadingSkeleton variant="list-row" count={4} />
            ) : visibleSuggestions.length === 0 ? (
              <EmptyState icon="search" title="No players found" description="Try a different name." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleSuggestions.map((s) => {
                  const bk = s.latestBooking;
                  const active = isActive(s.lastActiveAt);
                  return (
                    <button
                      key={s.id}
                      className="organizer m-0! disabled:opacity-50"
                      disabled={starting}
                      onClick={() => startWithSuggestion(s)}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={s.avatarUrl} name={s.displayName} size={44} />
                        {s.lastActiveAt != null && (
                          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                        )}
                      </div>
                      <div className="meta min-w-0">
                        <div className="name truncate">{s.displayName}</div>
                        <div className="t-sm truncate">
                          {bk ? (
                            <span>
                              Booked {timeAgo(bk.createdAt)}
                              {bk.date ? ` · ${prettyBookingDate(bk.date)}` : ''}
                              {bk.startTime ? `, ${to12h(bk.startTime)}` : ''}
                            </span>
                          ) : (
                            'Member'
                          )}
                          {s.isMember && bk && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)]">
                              <Icon name="star" size={9} /> Member
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon name="message" size={18} />
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Non-owner: existing search flow ── */}
          {!isOwner && (
            query.trim().length < 2 ? (
              <p className="t-sm px-1">Type at least 2 letters to find a player.</p>
            ) : searching ? (
              <LoadingSkeleton variant="list-row" count={4} />
            ) : searched && results.length === 0 ? (
              <EmptyState icon="search" title="No players found" description="Try a different name." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {results.map((p) => {
                  const active = isActive(p.lastActiveAt);
                  return (
                  <button
                    key={p.id}
                    className="organizer m-0! disabled:opacity-50"
                    disabled={starting}
                    onClick={() => startWith(p)}
                  >
                    <div className="relative shrink-0">
                      <Avatar src={p.avatarUrl} name={p.displayName} size={44} />
                      {p.lastActiveAt != null && (
                        <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                      )}
                    </div>
                    <div className="meta min-w-0">
                      <div className="name truncate">{p.displayName}</div>
                      <div className="t-sm truncate">
                        {p.skillLevel != null ? `DUPR ${p.skillLevel}` : p.skillLevelLabel ?? 'Player'}
                      </div>
                    </div>
                    <Icon name="message" size={18} />
                  </button>
                );
                })}
              </div>
            )
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
              const active = isActive(c.otherParticipant?.lastActiveAt);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="organizer m-0! cursor-pointer"
                  onClick={() => onNavigate('chat', { id: c.id, name })}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('chat', { id: c.id, name }); }}
                >
                  <div className="relative shrink-0">
                    <Avatar src={c.otherParticipant?.avatarUrl} name={name} size={44} />
                    {c.otherParticipant?.lastActiveAt != null && (
                      <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                    )}
                  </div>
                  <div className="meta min-w-0">
                    {c.contextType && (
                      <div className="truncate" style={{ color: 'var(--muted)', marginBottom: 1, fontSize: 11 }}>
                        {c.contextType === 'venue' ? (
                          <span className="inline-flex items-center" style={{ gap: 3 }}>
                            <Icon name="sports_tennis" size={10} />
                            {c.contextLabel || 'Venue inquiry'}
                          </span>
                        ) : c.contextType === 'booking' ? (
                          <span className="inline-flex items-center" style={{ gap: 3 }}>
                            <Icon name="event" size={10} />
                            {c.contextLabel || 'Booking inquiry'}
                          </span>
                        ) : (
                          c.contextType
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="name truncate">{name}</div>
                      <div className="t-sm shrink-0">{timeAgo(c.lastAt)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`t-sm truncate ${c.unread > 0 ? 'font-bold text-[var(--ink)]' : ''}`}>
                        {c.lastBody ? cleanPreview(c.lastBody) : 'No messages yet'}
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
