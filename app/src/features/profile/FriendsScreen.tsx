import { useEffect, useState, useCallback } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { apiImageUrl } from '../../shared/lib/api';
import {
  listFriends,
  listPendingFriendRequests,
  searchFriendableUsers,
  suggestFriends,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  startConversation,
  type ApiFriend,
  type ApiFriendProfile,
} from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';
import type { Navigate } from '../../shared/lib/navigation';

interface FriendsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const TABS = ['Friends', 'Requests', 'Find Friends'] as const;
type Tab = (typeof TABS)[number];

/** Persist active tab in sessionStorage so it survives a reload. */
const TAB_KEY = 'pb-friends-tab';
function readTab(): Tab {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return TABS.includes(v as Tab) ? (v as Tab) : 'Friends';
  } catch { return 'Friends'; }
}
function writeTab(t: Tab) {
  try { sessionStorage.setItem(TAB_KEY, t); } catch { /* ignore */ }
}

function roleBadge(roleDefault: string): { label: string; color: string } {
  switch (roleDefault) {
    case 'coach': return { label: 'Coach', color: '#2563eb' };
    case 'organizer': return { label: 'Organizer', color: '#7c3aed' };
    default: return { label: 'Player', color: '#16a34a' };
  }
}

// Darker green — used for action buttons and status text (replaces --lime which is too light).
const GREEN = '#16a34a';
const GREEN_DIM = '#15803d';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Client-side filter for Friends / Requests tabs. */
function filterByName<T extends { friend: { displayName: string } }>(items: T[], q: string): T[] {
  if (!q.trim()) return items;
  const lower = q.trim().toLowerCase();
  return items.filter((x) => x.friend.displayName.toLowerCase().includes(lower));
}

/* ── Small static sub-components (outside FriendsScreen so React
 *     doesn't treat them as new component types every render). ─── */

function SearchInput({ value, onChange, placeholder, big }: { value: string; onChange: (v: string) => void; placeholder: string; big?: boolean }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
        <Icon name="search" size={big ? 18 : 16} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-[var(--field-border)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--lime)]"
        style={big ? { paddingLeft: '2.5rem', paddingTop: '0.75rem', paddingBottom: '0.75rem', fontSize: '14px' } : undefined}
      />
    </div>
  );
}

function FriendRow({ friend, right }: { friend: ApiFriendProfile; right: React.ReactNode }) {
  const badge = roleBadge(friend.roleDefault);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--hairline)] last:border-b-0">
      <div
        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{
          background: friend.avatarUrl
            ? `url(${apiImageUrl(friend.avatarUrl)}) center/cover no-repeat`
            : 'var(--muted)',
        }}
      >
        {!friend.avatarUrl && getInitials(friend.displayName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-[var(--ink)] truncate">{friend.displayName}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badge.color }}>
            {badge.label}
          </span>
          {friend.skillLevelLabel && (
            <span className="text-[11px] font-semibold text-[var(--muted)]">{friend.skillLevelLabel}</span>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function FriendsScreen({ onNavigate, onBack }: FriendsScreenProps) {
  const [tab, setTab] = useState<Tab>(readTab);

  // Friends list
  const [friends, setFriends] = useState<ApiFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  // Pending requests
  const [requests, setRequests] = useState<ApiFriend[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Find friends search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiFriendProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Suggestions (shown when search is empty on Find Friends tab)
  const [suggestions, setSuggestions] = useState<(ApiFriendProfile & { distanceKm?: number })[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Load suggestions when switching to Find Friends tab
  useEffect(() => {
    if (tab !== 'Find Friends') return;
    let alive = true;
    setSuggestionsLoading(true);
    (async () => {
      // Try to get current location for nearby suggestions.
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300_000 }),
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* no location — fallback to shared games/clubs */ }
      try {
        const rows = await suggestFriends(lat, lng);
        if (alive) setSuggestions(rows);
      } catch { /* ignore */ }
      if (alive) setSuggestionsLoading(false);
    })();
    return () => { alive = false; };
  }, [tab]);

  // Action states
  const [actionState, setActionState] = useState<Record<string, string>>({});
  // Maps userId → friend request ID so we can cancel a sent request.
  const [requestIdByUser, setRequestIdByUser] = useState<Record<string, string>>({});

  // Local search for Friends + Requests tabs
  const [friendSearch, setFriendSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');

  const goTab = (t: Tab) => {
    setTab(t);
    writeTab(t);
    setFriendSearch('');
    setRequestSearch('');
    setSearchQuery('');
  };

  const reloadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try { setFriends(await listFriends()); } catch (e) {
      setFriendsError(e instanceof Error ? e.message : 'Failed to load friends.');
    } finally { setFriendsLoading(false); }
  }, []);

  const reloadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const rows = await listPendingFriendRequests();
      setRequests(rows);
      // Clear local "sent" state for any user whose pending request is gone
      // (they rejected, cancelled, or it was handled elsewhere).
      const sentIds = new Set(rows.filter((r) => r.sentByMe).map((r) => r.friend.id));
      setActionState((prev) => {
        const next: Record<string, string> = {};
        for (const [key, val] of Object.entries(prev)) {
          // Keep non-sent states and still-pending sent states.
          if (val !== 'sent' || sentIds.has(key)) next[key] = val;
        }
        return next;
      });
      setRequestIdByUser((prev) => {
        const next: Record<string, string> = {};
        for (const [key, val] of Object.entries(prev)) {
          if (sentIds.has(key)) next[key] = val;
        }
        return next;
      });
    } catch { /* best-effort */ }
    finally { setRequestsLoading(false); }
  }, []);

  useEffect(() => { reloadFriends(); reloadRequests(); }, [reloadFriends, reloadRequests]);

  // Realtime refresh — when someone accepts/rejects a friend request,
  // the SSE `notification.created` event triggers a refetch.
  useEffect(() => onRealtime('notification', () => { reloadFriends(); reloadRequests(); }), [reloadFriends, reloadRequests]);

  // Debounced remote search for Find Friends tab
  useEffect(() => {
    if (tab !== 'Find Friends' || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const rows = await searchFriendableUsers(searchQuery.trim());
        if (alive) setSearchResults(rows);
      } catch (e) {
        if (alive) setSearchError(e instanceof Error ? e.message : 'Search failed.');
      } finally { if (alive) setSearchLoading(false); }
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [searchQuery, tab]);

  const handleAddFriend = async (userId: string) => {
    setActionState((s) => ({ ...s, [userId]: 'sending' }));
    try {
      const res = await sendFriendRequest(userId);
      setActionState((s) => ({ ...s, [userId]: 'sent' }));
      if (res.id) setRequestIdByUser((s) => ({ ...s, [userId]: res.id }));
      reloadRequests();
    } catch { setActionState((s) => { const n = { ...s }; delete n[userId]; return n; }); }
  };

  const handleCancelRequest = async (userId: string) => {
    const reqId = requestIdByUser[userId];
    if (!reqId) return;
    setActionState((s) => ({ ...s, [userId]: 'removing' }));
    try {
      await removeFriend(reqId);
      setActionState((s) => ({ ...s, [userId]: 'removed' }));
      reloadRequests();
    } catch { setActionState((s) => { const n = { ...s }; delete n[userId]; return n; }); }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    const key = accept ? `accept-${requestId}` : `reject-${requestId}`;
    setActionState((s) => ({ ...s, [key]: accept ? 'accepting' : 'rejecting' }));
    try {
      await respondToFriendRequest(requestId, accept);
      setActionState((s) => ({ ...s, [key]: accept ? 'accepted' : 'rejected' }));
      reloadFriends();
      reloadRequests();
    } catch { setActionState((s) => { const n = { ...s }; delete n[key]; return n; }); }
  };

  const handleMessage = async (userId: string) => {
    try {
      const conv = await startConversation(userId);
      if (conv?.id) onNavigate('chat', { id: conv.id });
    } catch { /* ignore */ }
  };

  const handleRemove = async (friendshipId: string) => {
    setActionState((s) => ({ ...s, [friendshipId]: 'removing' }));
    try {
      await removeFriend(friendshipId);
      setActionState((s) => ({ ...s, [friendshipId]: 'removed' }));
      reloadFriends();
    } catch { setActionState((s) => { const n = { ...s }; delete n[friendshipId]; return n; }); }
  };

  const pendingReceived = requests.filter((r) => !r.sentByMe);
  const pendingSent = requests.filter((r) => r.sentByMe);

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--field-border)] pt-[calc(16px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} title="Friends" className="pb-2!" />
        <div className="scroll-x px-5 pt-1 pb-3 flex gap-2">
          {TABS.map((t) => (
            <Chip key={t} selected={tab === t} onClick={() => goTab(t)}>
              {t === 'Requests' && pendingReceived.length > 0 ? `Requests (${pendingReceived.length})` : t}
            </Chip>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-10">
        <DemoBranch
          loading={<div className="px-5"><LoadingSkeleton variant="list-row" count={3} /></div>}
          error={<ErrorState title="Couldn't load friends" message={friendsError || ''} onRetry={reloadFriends} />}
          empty={<EmptyState icon="people" title="No friends yet" description="Find players, coaches, and organizers to connect with." />}
        >
          {/* ── Friends tab ──────────────────────────────────── */}
          {tab === 'Friends' && (
            friendsLoading ? (
              <div className="px-5"><LoadingSkeleton variant="list-row" count={3} /></div>
            ) : friendsError ? (
              <ErrorState title="Couldn't load friends" message={friendsError} onRetry={reloadFriends} />
            ) : (
              <div className="px-5 flex flex-col gap-3 pt-3">
                <SearchInput value={friendSearch} onChange={setFriendSearch} placeholder="Filter friends…" />
                {friends.length === 0 ? (
                  <EmptyState icon="people" title="No friends yet" description="Find players, coaches, and organizers to connect with." />
                ) : (() => {
                  const filtered = filterByName(friends, friendSearch);
                  if (filtered.length === 0) {
                    return <EmptyState icon="search" title="No matches" description={`No friends matching "${friendSearch.trim()}"`} />;
                  }
                  return (
                    <div className="flex flex-col gap-1">
                      {filtered.map((f) => {
                        const removing = actionState[f.id] === 'removing';
                        const removed = actionState[f.id] === 'removed';
                        if (removed) return null;
                        return (
                          <FriendRow
                            key={f.id}
                            friend={f.friend}
                            right={
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMessage(f.friend.id)}
                                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                                  aria-label={`Message ${f.friend.displayName}`}
                                >
                                  <Icon name="chat_bubble" size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemove(f.id)}
                                  disabled={removing}
                                  className="shrink-0 text-[12px] font-bold text-[var(--coral)] px-3 py-1.5 rounded-xl hover:bg-[var(--coral)]/10 disabled:opacity-50"
                                >
                                  {removing ? 'Unfriending…' : 'Unfriend'}
                                </button>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )
          )}

          {/* ── Requests tab ─────────────────────────────────── */}
          {tab === 'Requests' && (
            requestsLoading ? (
              <div className="px-5"><LoadingSkeleton variant="list-row" count={2} /></div>
            ) : (
              <div className="px-5 flex flex-col gap-3 pt-3">
                <SearchInput value={requestSearch} onChange={setRequestSearch} placeholder="Filter requests…" />
                {requests.length === 0 ? (
                  <EmptyState icon="person_add" title="No pending requests" description="Friend requests you send or receive will appear here." />
                ) : (
                  <>

                {/* Received */}
                {(() => {
                  const filtered = filterByName(pendingReceived, requestSearch);
                  if (filtered.length === 0 && requestSearch.trim()) {
                    return <EmptyState icon="search" title="No matches" description={`No requests matching "${requestSearch.trim()}"`} />;
                  }
                  if (filtered.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Received</h3>
                      <div className="flex flex-col gap-1">
                        {filtered.map((r) => {
                          const acceptKey = `accept-${r.id}`;
                          const rejectKey = `reject-${r.id}`;
                          const accepting = actionState[acceptKey] === 'accepting';
                          const rejecting = actionState[rejectKey] === 'rejecting';
                          const accepted = actionState[acceptKey] === 'accepted';
                          const rejected = actionState[rejectKey] === 'rejected';
                          if (accepted || rejected) return null;
                          return (
                            <FriendRow
                              key={r.id}
                              friend={r.friend}
                              right={
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRespond(r.id, true)}
                                    disabled={accepting || rejecting}
                                    className="shrink-0 text-[12px] font-bold rounded-xl px-3.5 py-1.5 text-white disabled:opacity-50"
                                    style={{ background: GREEN, color: '#fff' }}
                                  >
                                    {accepting ? '…' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => handleRespond(r.id, false)}
                                    disabled={accepting || rejecting}
                                    className="shrink-0 text-[12px] font-bold rounded-xl px-3.5 py-1.5 text-[var(--ink)] bg-[var(--surface-2)] disabled:opacity-50"
                                  >
                                    {rejecting ? '…' : 'Reject'}
                                  </button>
                                </div>
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Sent */}
                {(() => {
                  const filtered = filterByName(pendingSent, requestSearch);
                  if (filtered.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Sent</h3>
                      <div className="flex flex-col gap-1">
                        {filtered.map((r) => {
                          const cancelling = actionState[r.id] === 'removing';
                          const cancelled = actionState[r.id] === 'removed';
                          if (cancelled) return null;
                          return (
                            <FriendRow
                              key={r.id}
                              friend={r.friend}
                              right={
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-semibold text-[var(--muted)]">Pending</span>
                                  <button
                                    onClick={() => handleRemove(r.id)}
                                    disabled={cancelling}
                                    className="shrink-0 text-[12px] font-bold text-[var(--coral)] px-2 py-1 rounded-lg hover:bg-[var(--coral)]/10 disabled:opacity-50"
                                  >
                                    {cancelling ? '…' : 'Cancel'}
                                  </button>
                                </div>
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                  </>
                )}
              </div>
            )
          )}

          {/* ── Find Friends tab ──────────────────────────────── */}
          {tab === 'Find Friends' && (
            <div className="px-5 flex flex-col gap-3 pt-3">
              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name…" big />

              {searchQuery.trim().length < 2 ? (
                suggestionsLoading ? (
                  <div><LoadingSkeleton variant="list-row" count={4} /></div>
                ) : suggestions.length === 0 ? (
                  <p className="text-[13px] font-semibold text-[var(--muted)] text-center py-8">
                    Type a name to find players, coaches, and organizers.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {suggestions.map((person) => {
                      const badge = roleBadge(person.roleDefault);
                      const sending = actionState[person.id] === 'sending';
                      const sent = actionState[person.id] === 'sent';
                      const dist = person.distanceKm != null ? `${person.distanceKm} km away` : null;
                      return (
                        <div key={person.id} className="flex items-center gap-3 py-3 border-b border-[var(--hairline)] last:border-b-0">
                          <div
                            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{
                              background: person.avatarUrl
                                ? `url(${apiImageUrl(person.avatarUrl)}) center/cover no-repeat`
                                : 'var(--muted)',
                            }}
                          >
                            {!person.avatarUrl && getInitials(person.displayName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-[var(--ink)] truncate">{person.displayName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badge.color }}>
                                {badge.label}
                              </span>
                              {person.skillLevelLabel && (
                                <span className="text-[11px] font-semibold text-[var(--muted)]">{person.skillLevelLabel}</span>
                              )}
                              {dist && (
                                <span className="text-[11px] font-semibold text-[#16a34a]">{dist}</span>
                              )}
                            </div>
                            {person.bio && (
                              <div className="text-[12px] text-[var(--muted)] truncate mt-0.5">{person.bio}</div>
                            )}
                          </div>
                          {sent ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-bold text-[#16a34a]">Request sent</span>
                              <button
                                onClick={() => handleCancelRequest(person.id)}
                                disabled={actionState[person.id] === 'removing'}
                                className="shrink-0 text-[12px] font-bold text-[var(--coral)] px-2 py-1 rounded-lg hover:bg-[var(--coral)]/10 disabled:opacity-50"
                              >
                                {actionState[person.id] === 'removing' ? '…' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddFriend(person.id)}
                              disabled={sending}
                              className="shrink-0 flex items-center gap-1 text-[12px] font-bold rounded-xl px-3.5 py-1.5 text-white disabled:opacity-50"
                              style={{ background: GREEN, color: '#fff' }}
                            >
                              <Icon name="person_add" size={14} />
                              {sending ? '…' : 'Add friend'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : searchLoading ? (
                <div><LoadingSkeleton variant="list-row" count={3} /></div>
              ) : searchError ? (
                <ErrorState title="Search failed" message={searchError} onRetry={() => setSearchQuery((q) => q + ' ')} />
              ) : searchResults.length === 0 ? (
                <EmptyState icon="person_search" title="No one found" description="Try a different name." />
              ) : (
                <div className="flex flex-col gap-1">
                  {searchResults.map((person) => {
                    const badge = roleBadge(person.roleDefault);
                    const sending = actionState[person.id] === 'sending';
                    const sent = actionState[person.id] === 'sent';
                    return (
                      <div key={person.id} className="flex items-center gap-3 py-3 border-b border-[var(--hairline)] last:border-b-0">
                        <div
                          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{
                            background: person.avatarUrl
                              ? `url(${apiImageUrl(person.avatarUrl)}) center/cover no-repeat`
                              : 'var(--muted)',
                          }}
                        >
                          {!person.avatarUrl && getInitials(person.displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-bold text-[var(--ink)] truncate">{person.displayName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badge.color }}>
                              {badge.label}
                            </span>
                            {person.skillLevelLabel && (
                              <span className="text-[11px] font-semibold text-[var(--muted)]">{person.skillLevelLabel}</span>
                            )}
                          </div>
                          {person.bio && (
                            <div className="text-[12px] text-[var(--muted)] truncate mt-0.5">{person.bio}</div>
                          )}
                        </div>
                        {sent ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-[#16a34a]">Request sent</span>
                            <button
                              onClick={() => handleCancelRequest(person.id)}
                              disabled={actionState[person.id] === 'removing'}
                              className="shrink-0 text-[12px] font-bold text-[var(--coral)] px-2 py-1 rounded-lg hover:bg-[var(--coral)]/10 disabled:opacity-50"
                            >
                              {actionState[person.id] === 'removing' ? '…' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(person.id)}
                            disabled={sending}
                            className="shrink-0 flex items-center gap-1 text-[12px] font-bold rounded-xl px-3.5 py-1.5 text-white disabled:opacity-50"
                            style={{ background: GREEN, color: '#fff' }}
                          >
                            <Icon name="person_add" size={14} />
                            {sending ? '…' : 'Add friend'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DemoBranch>
      </div>
    </div>
  );
}
