import { useEffect, useState, useCallback } from 'react';
import type { V2ScreenChrome } from '../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../shared/components/ui/V2Skeleton';
import {
  apiImageUrl,
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
import { useFriendRequestStore } from '../../shared/lib/friendRequestStore';
import { onRealtime } from '../../shared/lib/realtimeBus';
import { getInitials } from '../../shared/lib/initials';

interface FriendsPanelProps {
  chrome: V2ScreenChrome;
}

const TABS = ['Friends', 'Requests', 'Find Friends'] as const;
type Tab = (typeof TABS)[number];

// Remembers the active sub-tab across remounts so viewing a player's profile and
// coming back lands where you were (e.g. Find Friends), not reset to Friends.
// Module-scoped for the session — mirrors clubTabMemory in ClubDetailsScreen.
let friendsTabMemory: Tab = 'Friends';

function roleLabel(roleDefault: string): { label: string; cls: string } {
  switch (roleDefault) {
    case 'coach': return { label: 'Coach', cls: 'coach' };
    case 'organizer': return { label: 'Organizer', cls: 'organizer' };
    default: return { label: 'Player', cls: 'player' };
  }
}

/** Client-side filter for the Friends / Requests tabs. */
function filterByName<T extends { friend: { displayName: string } }>(items: T[], q: string): T[] {
  if (!q.trim()) return items;
  const lower = q.trim().toLowerCase();
  return items.filter((x) => x.friend.displayName.toLowerCase().includes(lower));
}

/* ── Static sub-components (outside FriendsPanel so React doesn't treat them
 *    as new component types on every render). ─────────────────────────────── */

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search-wrap">
      <div className="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </div>
    </div>
  );
}

function FriendRow({ person, extra, right, onOpen }: { person: ApiFriendProfile; extra?: React.ReactNode; right: React.ReactNode; onOpen: () => void }) {
  const role = roleLabel(person.roleDefault);
  return (
    <div className="friend-row">
      <button type="button" className="friend-open" onClick={onOpen} aria-label={`View ${person.displayName}'s profile`}>
        <div
          className="friend-av"
          aria-hidden="true"
          style={person.avatarUrl ? { background: `url(${apiImageUrl(person.avatarUrl)}) center/cover no-repeat` } : undefined}
        >
          {!person.avatarUrl && getInitials(person.displayName)}
        </div>
        <div className="friend-info">
          <div className="friend-name">{person.displayName}</div>
          <div className="friend-meta">
            <span className={`role-pill ${role.cls}`}>{role.label}</span>
            {person.skillLevelLabel && <span className="friend-skill">{person.skillLevelLabel}</span>}
            {extra}
          </div>
          {person.bio && <div className="friend-bio">{person.bio}</div>}
        </div>
      </button>
      <div className="friend-acts">{right}</div>
    </div>
  );
}

/** The Friends half of the Social tab. Body only — `SocialScreen` owns the shell. */
export function FriendsPanel({ chrome }: FriendsPanelProps) {
  const { onNavigate, isLoggedIn, requireAuth } = chrome;
  const [tab, setTab] = useState<Tab>(() => friendsTabMemory);

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

  // Action states
  const [actionState, setActionState] = useState<Record<string, string>>({});
  // Maps userId → friend request ID so we can cancel a sent request.
  const [requestIdByUser, setRequestIdByUser] = useState<Record<string, string>>({});

  // Local search for Friends + Requests tabs
  const [friendSearch, setFriendSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');

  // The Social tab badge reads this store. This screen already fetches the
  // pending list, so it sets the count exactly instead of triggering a re-poll.
  const setPending = useFriendRequestStore((s) => s.setPending);

  const goTab = (t: Tab) => {
    friendsTabMemory = t;
    setTab(t);
    setFriendSearch('');
    setRequestSearch('');
    setSearchQuery('');
  };

  /** Tapping a row opens that player's public profile. */
  const openProfile = (id: string) => onNavigate('player-profile', { id });

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
      setPending(rows.filter((r) => !r.sentByMe).length);
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
  }, [setPending]);

  useEffect(() => {
    if (!isLoggedIn) { setFriendsLoading(false); return; }
    reloadFriends();
    reloadRequests();
  }, [isLoggedIn, reloadFriends, reloadRequests]);

  // Realtime refresh — when someone sends/accepts/rejects a friend request the
  // SSE `notification.created` event lands on the bus and we refetch.
  useEffect(() => {
    if (!isLoggedIn) return;
    return onRealtime('notification', () => { reloadFriends(); reloadRequests(); });
  }, [isLoggedIn, reloadFriends, reloadRequests]);

  // Load suggestions when switching to Find Friends tab
  useEffect(() => {
    if (tab !== 'Find Friends' || !isLoggedIn) return;
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
  }, [tab, isLoggedIn]);

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

  /* Guests can still reach this panel by deep link (`/social?tab=friends`), so
   * it owns its signed-out state — the Social tab itself stays public, like Clubs. */
  if (!isLoggedIn) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👋</div>
        <p>Sign in to find players, send friend requests, and see who's playing near you.</p>
        <button className="social-crosslink" onClick={() => requireAuth('find players')}>Sign in</button>
      </div>
    );
  }

  const pendingReceived = requests.filter((r) => !r.sentByMe);
  const pendingSent = requests.filter((r) => r.sentByMe);

  const addButton = (person: ApiFriendProfile) => {
    const sending = actionState[person.id] === 'sending';
    if (actionState[person.id] === 'sent') {
      return (
        <>
          <span className="friend-sent">Request sent</span>
          <button onClick={() => handleCancelRequest(person.id)} disabled={actionState[person.id] === 'removing'} className="fbtn danger">
            {actionState[person.id] === 'removing' ? '…' : 'Cancel'}
          </button>
        </>
      );
    }
    return (
      <button onClick={() => handleAddFriend(person.id)} disabled={sending} className="fbtn primary">
        {sending ? '…' : '+ Add friend'}
      </button>
    );
  };

  return (
    <>
      <div className="filter-row" role="group" aria-label="Friends sections">
        {TABS.map((t) => (
          <button key={t} className={`filter-chip${tab === t ? ' active' : ''}`} onClick={() => goTab(t)}>
            {t}
            {t === 'Requests' && pendingReceived.length > 0 && <span className="friend-count">{pendingReceived.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Friends tab ──────────────────────────────────── */}
      {tab === 'Friends' && (
        friendsLoading ? (
          <V2Skeleton variant="club-list" count={4} />
        ) : friendsError ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p>{friendsError}</p>
            <button className="social-crosslink" onClick={reloadFriends}>Try again</button>
          </div>
        ) : (
          <>
            <SearchInput value={friendSearch} onChange={setFriendSearch} placeholder="Filter friends…" />
            {friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🤝</div>
                <p>No friends yet. Find players, coaches, and organizers to connect with.</p>
                <button className="social-crosslink" onClick={() => goTab('Find Friends')}>Find players →</button>
              </div>
            ) : (() => {
              const filtered = filterByName(friends, friendSearch);
              if (filtered.length === 0) {
                return (
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <p>No friends matching “{friendSearch.trim()}”.</p>
                  </div>
                );
              }
              return (
                <div className="friend-list">
                  {filtered.map((f) => {
                    const removing = actionState[f.id] === 'removing';
                    if (actionState[f.id] === 'removed') return null;
                    return (
                      <FriendRow
                        key={f.id}
                        person={f.friend}
                        onOpen={() => openProfile(f.friend.id)}
                        right={
                          <>
                            <button onClick={() => handleMessage(f.friend.id)} className="fbtn icon" aria-label={`Message ${f.friend.displayName}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            </button>
                            <button onClick={() => handleRemove(f.id)} disabled={removing} className="fbtn danger">
                              {removing ? 'Unfriending…' : 'Unfriend'}
                            </button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              );
            })()}
          </>
        )
      )}

      {/* ── Requests tab ─────────────────────────────────── */}
      {tab === 'Requests' && (
        requestsLoading ? (
          <V2Skeleton variant="club-list" count={3} />
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>No pending requests. Friend requests you send or receive will appear here.</p>
          </div>
        ) : (
          <>
            <SearchInput value={requestSearch} onChange={setRequestSearch} placeholder="Filter requests…" />

            {/* Received */}
            {(() => {
              const filtered = filterByName(pendingReceived, requestSearch);
              if (filtered.length === 0 && requestSearch.trim()) {
                return (
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <p>No requests matching “{requestSearch.trim()}”.</p>
                  </div>
                );
              }
              if (filtered.length === 0) return null;
              return (
                <>
                  <div className="section-header"><h2 className="section-title">Received</h2></div>
                  <div className="friend-list">
                    {filtered.map((r) => {
                      const acceptKey = `accept-${r.id}`;
                      const rejectKey = `reject-${r.id}`;
                      const accepting = actionState[acceptKey] === 'accepting';
                      const rejecting = actionState[rejectKey] === 'rejecting';
                      if (actionState[acceptKey] === 'accepted' || actionState[rejectKey] === 'rejected') return null;
                      return (
                        <FriendRow
                          key={r.id}
                          person={r.friend}
                          onOpen={() => openProfile(r.friend.id)}
                          right={
                            <>
                              <button onClick={() => handleRespond(r.id, true)} disabled={accepting || rejecting} className="fbtn primary">
                                {accepting ? '…' : 'Confirm'}
                              </button>
                              <button onClick={() => handleRespond(r.id, false)} disabled={accepting || rejecting} className="fbtn quiet">
                                {rejecting ? '…' : 'Reject'}
                              </button>
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Sent */}
            {(() => {
              const filtered = filterByName(pendingSent, requestSearch);
              if (filtered.length === 0) return null;
              return (
                <>
                  <div className="section-header"><h2 className="section-title">Sent</h2></div>
                  <div className="friend-list">
                    {filtered.map((r) => {
                      const cancelling = actionState[r.id] === 'removing';
                      if (actionState[r.id] === 'removed') return null;
                      return (
                        <FriendRow
                          key={r.id}
                          person={r.friend}
                          onOpen={() => openProfile(r.friend.id)}
                          right={
                            <>
                              <span className="friend-pending">Pending</span>
                              <button onClick={() => handleRemove(r.id)} disabled={cancelling} className="fbtn danger">
                                {cancelling ? '…' : 'Cancel'}
                              </button>
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </>
        )
      )}

      {/* ── Find Friends tab ─────────────────────────────── */}
      {tab === 'Find Friends' && (
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name…" />

          {searchQuery.trim().length < 2 ? (
            suggestionsLoading ? (
              <V2Skeleton variant="club-list" count={4} />
            ) : suggestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <p>Type a name to find players, coaches, and organizers.</p>
              </div>
            ) : (
              <>
                {/* `/friends/suggestions` has three tiers: geolocated (distances present),
                    shared clubs/games, then a random sample. Only the first is genuinely
                    "near you" — claiming it for the others would be a lie. Same copy as
                    the home rail's fallback heading. */}
                <div className="section-header">
                  <h2 className="section-title">
                    {suggestions.some((s) => s.distanceKm != null) ? 'Players near you' : 'People you may know'}
                  </h2>
                </div>
                <div className="friend-list">
                  {suggestions.map((person) => (
                    <FriendRow
                      key={person.id}
                      person={person}
                      onOpen={() => openProfile(person.id)}
                      extra={
                        person.mutualCount != null && person.mutualCount > 0
                          ? (
                            <span className="friend-dist">
                              {person.mutualFriends && person.mutualFriends.length > 0 && (
                                <span className="friend-mutual-avatars">
                                  {person.mutualFriends.slice(0, 3).map((mf, i) => (
                                    <span
                                      key={mf.id}
                                      className="friend-mutual-avatar"
                                      style={{ zIndex: 3 - i, marginLeft: i === 0 ? 0 : -8 }}
                                    >
                                      {mf.avatarUrl
                                        ? <img src={apiImageUrl(mf.avatarUrl)} alt="" className="h-full w-full rounded-full object-cover" />
                                        : <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--ink-fill)] text-[8px] font-bold">{mf.displayName?.[0] ?? '?'}</span>}
                                    </span>
                                  ))}
                                </span>
                              )}
                              <span>{person.mutualCount} mutual friend{person.mutualCount === 1 ? '' : 's'}</span>
                            </span>
                          )
                          : person.distanceKm != null
                            ? <span className="friend-dist">{person.distanceKm} km away</span>
                            : undefined
                      }
                      right={addButton(person)}
                    />
                  ))}
                </div>
              </>
            )
          ) : searchLoading ? (
            <V2Skeleton variant="club-list" count={3} />
          ) : searchError ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <p>{searchError}</p>
              <button className="social-crosslink" onClick={() => setSearchQuery((q) => q + ' ')}>Try again</button>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🙅</div>
              <p>No one found. Try a different name.</p>
            </div>
          ) : (
            <div className="friend-list">
              {searchResults.map((person) => (
                <FriendRow key={person.id} person={person} onOpen={() => openProfile(person.id)} right={addButton(person)} />
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ height: 20 }} />
    </>
  );
}
