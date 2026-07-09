import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { listNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, respondToVenueMembershipInvite, getVenue, listPublicPlans, respondToFriendRequest, type ApiNotification, type ApiSubscriptionPlan } from '../../shared/lib/api';
import { MembershipSheet } from '../venues/MembershipSheet';
import { useAuthStore } from '../../shared/lib/authStore';
import { useNotificationStore } from '../../shared/lib/notificationStore';
import { onRealtime } from '../../shared/lib/realtimeBus';
import { userHasPermission } from '../../shared/lib/permissions';
import { enablePush, isPushSupported, pushPermission } from '../../shared/lib/push';
import type { Navigate } from '../../shared/lib/navigation';

interface NotificationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type IconBg = 'lime' | 'blue' | 'coral';

/** A colored chip per notification kind, so the feed reads at a glance. */
function bgForType(type?: string | null): IconBg {
  switch (type) {
    case 'game_full':                 return 'lime';
    case 'venue_membership_invite':   return 'lime';
    case 'venue_membership_removed':  return 'coral';
    case 'booking_pending_approval':  return 'coral';
    case 'booking_approved':          return 'lime';
    case 'friend_request':            return 'lime';
    case 'message':                   return 'blue';
    case 'alert':                     return 'coral';
    default:                          return 'blue';
  }
}

/** A venue membership invite carries the venue id in its linkUrl (`/venues/<id>`). */
function venueIdFromInvite(n: ApiNotification): string | null {
  const m = (n.linkUrl || '').match(/^\/venues\/([0-9a-fA-F]{24})$/);
  return m ? m[1] : null;
}

/** The server stamps an `icon`; fall back to a bell for anything unlabelled. */
function iconFor(n: ApiNotification): string {
  return n.icon || 'bell';
}

/** Strip the server-prepended notification-type prefix from titles so
 *  "chat Kenneth Hernandez" → "Kenneth Hernandez". */
const TITLE_PREFIXES = ['chat', 'forum', 'message', 'alert'];
function cleanTitle(title: string): string {
  for (const p of TITLE_PREFIXES) {
    if (title.startsWith(p + ' ')) return title.slice(p.length + 1);
  }
  return title;
}

/** "Just now" / "5m ago" / "3h ago" / "Yesterday" / "Jun 7" from an ISO date. */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Map a stored linkUrl (e.g. "/games/<id>") to an in-app navigation. */
function navigateFromLink(linkUrl: string | null | undefined, onNavigate: Navigate): boolean {
  if (!linkUrl) return false;
  // Game chat message → straight into the game's group chat, not the lobby.
  const gameChat = linkUrl.match(/^\/games\/([0-9a-fA-F]{24})\/chat$/);
  if (gameChat) { onNavigate('game-chat', { id: gameChat[1] }); return true; }
  const game = linkUrl.match(/^\/games\/([0-9a-fA-F]{24})$/);
  if (game) { onNavigate('game-details', { id: game[1] }); return true; }
  const chat = linkUrl.match(/^\/messages\/([0-9a-fA-F]{24})$/);
  if (chat) { onNavigate('chat', { id: chat[1] }); return true; }
  // Club post: /clubs/<slug> → club detail; /clubs/<slug>/posts/<id> → single post
  const clubPost = linkUrl.match(/^\/clubs\/([a-z0-9-]+)\/posts\/([0-9a-fA-F]{24})$/);
  if (clubPost) { onNavigate('club-post', { id: clubPost[1], postId: clubPost[2] }); return true; }
  const club = linkUrl.match(/^\/clubs\/([a-z0-9-]+)$/);
  if (club) { onNavigate('club-details', { id: club[1] }); return true; }
  // Friends
  const friendsLink = linkUrl.match(/^\/friends/);
  if (friendsLink) { onNavigate('friends'); return true; }
  // Owner Reports dashboard (e.g. /owner/reports?status=pending_approval; /owner/bookings is the legacy alias).
  const ownerBookings = linkUrl.match(/^\/owner\/(?:reports|bookings)(\?.*)?$/);
  if (ownerBookings) {
    const sp = new URLSearchParams(linkUrl.includes('?') ? linkUrl.slice(linkUrl.indexOf('?')) : '');
    onNavigate('owner-bookings', sp.get('status') ? { status: sp.get('status')! } : {});
    return true;
  }
  return false;
}

const FILTERS = ['All', 'Unread', 'Friend Request'] as const;
type Filter = (typeof FILTERS)[number];

type PushState = 'idle' | 'enabling' | 'on' | 'denied' | 'unsupported';

function initialPushState(): PushState {
  if (!isPushSupported()) return 'unsupported';
  const p = pushPermission();
  return p === 'granted' ? 'on' : p === 'denied' ? 'denied' : 'idle';
}

export function NotificationsScreen({ onNavigate, onBack }: NotificationsScreenProps) {
  const me = useAuthStore((s) => s.user);
  const canManagePush = userHasPermission(me, 'user.notifications.manage');
  const [pushState, setPushState] = useState<PushState>(initialPushState);

  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<Filter>('All');
  // Per-notification state for membership invites the player accepts/declines inline.
  const [inviteState, setInviteState] = useState<Record<string, 'accepting' | 'declining' | 'accepted' | 'declined'>>({});
  // When the player taps Accept but has no subscription yet, open the Join
  // Membership sheet so they pick a plan first.
  const [membershipSheet, setMembershipSheet] = useState<{
    notifId: string;
    venueId: string;
    venueName: string;
    currency: string;
    plans: ApiSubscriptionPlan[] | null;
  } | null>(null);

  const enable = async () => {
    setPushState('enabling');
    const res = await enablePush();
    setPushState(
      res.ok ? 'on' : res.reason === 'denied' ? 'denied' : res.reason === 'unsupported' ? 'unsupported' : 'idle',
    );
  };
  // Show the prompt only to users who can manage notifications, and only when
  // push is available but not yet granted on this device.
  const showPushBanner = canManagePush && (pushState === 'idle' || pushState === 'enabling' || pushState === 'denied');

  useEffect(() => {
    let alive = true;
    listNotifications()
      .then((rows) => { if (alive) setItems(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load notifications.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Refetch whenever a new notification arrives over the SSE stream, so invites
  // and other alerts appear instantly without a manual refresh.
  useEffect(() => onRealtime('notification', () => setReloadKey((k) => k + 1)), []);

  const retry = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1); };

  const unread = items.filter((n) => !n.isRead).length;
  const visible = filter === 'Unread'
    ? items.filter((n) => !n.isRead)
    : filter === 'Friend Request'
      ? items.filter((n) => n.type === 'friend_request')
      : items;

  // Keep the global unread badge in lockstep with what this screen shows (the
  // user is looking at the authoritative list here), so marking read updates the
  // bell/tab badge instantly without waiting for the next poll.
  const setUnread = useNotificationStore((s) => s.setUnread);
  useEffect(() => { setUnread(unread); }, [unread, setUnread]);

  const markAll = async () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true }))); // optimistic
    try { await markAllNotificationsRead(); } catch { /* best-effort */ }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id)); // optimistic
    try { await deleteNotification(id); } catch { /* best-effort */ }
  };

  const open = (n: ApiNotification) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); // optimistic
      void markNotificationRead(n.id).catch(() => { /* best-effort */ });
    }
    navigateFromLink(n.linkUrl, onNavigate);
  };

  // Accept/decline an owner-sent membership invite right from the notification.
  // When accepting: if the player already has a subscription → accept immediately.
  // If not → open the Join Membership sheet so they pick a plan first.
  const respondInvite = async (n: ApiNotification, accept: boolean) => {
    const venueId = venueIdFromInvite(n);
    if (!venueId) return;
    if (!accept) {
      setInviteState((s) => ({ ...s, [n.id]: 'declining' }));
      try {
        await respondToVenueMembershipInvite(venueId, false);
        setInviteState((s) => ({ ...s, [n.id]: 'declined' }));
        if (!n.isRead) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
          void markNotificationRead(n.id).catch(() => { /* best-effort */ });
        }
      } catch (e) {
        console.error('respondInvite decline failed:', e);
        setInviteState((s) => { const next = { ...s }; delete next[n.id]; return next; });
      }
      return;
    }
    // Accept — check if the player already has a subscription first.
    setInviteState((s) => ({ ...s, [n.id]: 'accepting' }));
    try {
      const venue = await getVenue(venueId);
      if (venue.viewerIsMember || venue.viewerMembershipTier) {
        // Already subscribed — accept immediately.
        await respondToVenueMembershipInvite(venueId, true, venue.viewerMembershipTier || undefined);
        setInviteState((s) => ({ ...s, [n.id]: 'accepted' }));
        if (!n.isRead) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
          void markNotificationRead(n.id).catch(() => { /* best-effort */ });
        }
      } else {
        // No subscription yet — fetch the venue's plans, then open the sheet
        // with them preloaded so it never flashes the hardcoded fallback.
        let plans: ApiSubscriptionPlan[] | null = null;
        try { plans = await listPublicPlans(venueId); } catch { /* empty — sheet falls back */ }
        setMembershipSheet({
          notifId: n.id,
          venueId,
          venueName: venue.displayName || 'this venue',
          currency: '₱',
          plans,
        });
        setInviteState((s) => { const next = { ...s }; delete next[n.id]; return next; });
      }
    } catch (e) {
      console.error('respondInvite accept failed:', e);
      setInviteState((s) => { const next = { ...s }; delete next[n.id]; return next; });
    }
  };

  // Called from the MembershipSheet when the player picks a plan.
  const acceptWithPlan = async (planId: string) => {
    if (!membershipSheet) return;
    const ms = membershipSheet;
    // Look up the plan name so the VenueMember tier shows "Monthly" etc., not the ObjectId.
    const plan = ms.plans?.find((p) => p.id === planId);
    const tier = plan?.name || planId;
    setMembershipSheet(null);
    setInviteState((s) => ({ ...s, [ms.notifId]: 'accepted' }));
    try {
      await respondToVenueMembershipInvite(ms.venueId, true, tier);
      const n = items.find((x) => x.id === ms.notifId);
      if (n && !n.isRead) {
        setItems((prev) => prev.map((x) => (x.id === ms.notifId ? { ...x, isRead: true } : x)));
        void markNotificationRead(ms.notifId).catch(() => { /* best-effort */ });
      }
    } catch (e) {
      console.error('acceptWithPlan failed:', e);
      setInviteState((s) => { const next = { ...s }; delete next[ms.notifId]; return next; });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--field-border)] pt-[calc(16px+env(safe-area-inset-top))]">
        <ScreenHeader
          onBack={onBack}
          title="Notifications"
          subtitle={`${unread} unread`}
          className="pb-2!"
          action={
            unread > 0 ? (
              <button onClick={markAll} className="rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold px-3.5 py-1.5">
                Mark all read
              </button>
            ) : undefined
          }
        />

        <div className="scroll-x px-5 pt-1 pb-2 flex gap-2">
          {FILTERS.map((c) => (
            <Chip key={c} selected={filter === c} onClick={() => setFilter(c)}>
              {c}
            </Chip>
          ))}
        </div>

        {showPushBanner && (
          <div className="px-5 pb-2">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3.5 flex items-center gap-3">
              <div className="ic blue"><Icon name="bell" size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[var(--ink)]">Turn on push notifications</div>
                <div className="text-[12px] font-semibold text-[var(--muted)]">
                  {pushState === 'denied'
                    ? 'Blocked in your browser settings — allow notifications for this site to get alerts.'
                    : 'Get alerted on this device the moment your lobby fills — even with the app closed.'}
                </div>
              </div>
              {pushState !== 'denied' && (
                <button
                  onClick={enable}
                  disabled={pushState === 'enabling'}
                  className="shrink-0 rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold px-3.5 py-2 disabled:opacity-60"
                >
                  {pushState === 'enabling' ? 'Enabling…' : 'Enable'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-10">
      <DemoBranch
        loading={
          <div className="px-5">
            <LoadingSkeleton variant="list-row" count={5} />
          </div>
        }
        error={
          <ErrorState
            title="Couldn't load notifications"
            message="We couldn't reach your inbox. Try again in a moment."
            onRetry={retry}
          />
        }
        empty={
          <EmptyState
            icon="bell"
            title="You're all caught up"
            description="No new notifications. We'll ping you when something happens."
          />
        }
      >
        {loading ? (
          <div className="px-5">
            <LoadingSkeleton variant="list-row" count={5} />
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load notifications"
            message={error}
            onRetry={retry}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="bell"
            title={
              filter === 'Unread' ? "You're all caught up"
              : filter === 'Friend Request' ? 'No friend requests'
              : 'No notifications yet'
            }
            description={
              filter === 'Unread'
                ? 'Nothing unread right now.'
                : filter === 'Friend Request'
                  ? 'Friend requests will appear here.'
                  : "We'll ping you when something happens — like when your game's lobby fills up."
            }
          />
        ) : (
          visible.map((n) => {
            // Membership invites: only show Accept/Decline while the notification is
            // still unread (player hasn't responded yet). Once read, render as a
            // regular notification — tapping navigates to the venue. This prevents
            // the buttons from reappearing after a re-render or owner removal.
            if (n.type === 'venue_membership_invite' && venueIdFromInvite(n)) {
              const st = inviteState[n.id];
              const resolved = st === 'accepted' || st === 'declined';
              const pending = !n.isRead && !resolved;
              const picking = membershipSheet?.notifId === n.id;
              if (pending || resolved) {
                return (
                  <div key={n.id} className={`notif ${!n.isRead ? 'unread' : ''}`}>
                    <div className={`ic ${bgForType(n.type)}`}>
                      <Icon name={iconFor(n)} size={18} />
                    </div>
                    <div className="body">
                      <div className="head">
                        <strong>{cleanTitle(n.title)}</strong>
                        {n.body ? <> — {n.body}</> : null}
                      </div>
                      <div className="time">{relativeTime(n.createdAt)}</div>
                      {resolved ? (
                        <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--muted)]">
                          <Icon name={st === 'accepted' ? 'check_circle' : 'cancel'} size={14} />
                          {st === 'accepted' ? "You're now a member" : 'Invitation declined'}
                        </div>
                      ) : picking ? (
                        <div className="mt-2 text-[12px] font-bold text-[var(--muted)]">
                          Pick a plan in the popup below…
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => respondInvite(n, true)}
                            disabled={!!st}
                            className="rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold px-3.5 py-1.5 disabled:opacity-60"
                          >
                            {st === 'accepting' ? 'Checking…' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => respondInvite(n, false)}
                            disabled={!!st}
                            className="rounded-xl bg-[var(--surface-2)] text-[var(--ink)] text-[13px] font-bold px-3.5 py-1.5 disabled:opacity-60"
                          >
                            {st === 'declining' ? 'Declining…' : 'Decline'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Already read (handled) — fall through to render as a regular notification.
            }

            // Friend requests: show Confirm/Reject while unread. Once read, render as
            // a regular notification — tapping navigates to /friends.
            if (n.type === 'friend_request') {
              const st = inviteState[n.id];
              const resolved = st === 'accepted' || st === 'declined';
              const pending = !n.isRead && !resolved;
              if (pending || resolved) {
                return (
                  <div key={n.id} className={`notif ${!n.isRead ? 'unread' : ''}`}>
                    <div className={`ic ${bgForType(n.type)}`}>
                      <Icon name={iconFor(n)} size={18} />
                    </div>
                    <div className="body">
                      <div className="head">
                        <strong>{cleanTitle(n.title)}</strong>
                        {n.body ? <> — {n.body}</> : null}
                      </div>
                      <div className="time">{relativeTime(n.createdAt)}</div>
                      {resolved ? (
                        <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--muted)]">
                          <Icon name={st === 'accepted' ? 'check_circle' : 'cancel'} size={14} />
                          {st === 'accepted' ? 'Friend request accepted' : 'Friend request declined'}
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const requestId = (n.tag || '').replace('friend-request-', '');
                              if (!requestId) { onNavigate('friends'); return; }
                              setInviteState((s) => ({ ...s, [n.id]: 'accepting' }));
                              try {
                                await respondToFriendRequest(requestId, true);
                                setInviteState((s) => ({ ...s, [n.id]: 'accepted' }));
                                if (!n.isRead) {
                                  setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                                  void markNotificationRead(n.id).catch(() => {});
                                }
                              } catch {
                                setInviteState((s) => { const next = { ...s }; delete next[n.id]; return next; });
                              }
                            }}
                            disabled={!!st}
                            className="rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold px-3.5 py-1.5 disabled:opacity-60"
                          >
                            {st === 'accepting' ? '…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const requestId = (n.tag || '').replace('friend-request-', '');
                              if (!requestId) { onNavigate('friends'); return; }
                              setInviteState((s) => ({ ...s, [n.id]: 'declining' }));
                              try {
                                await respondToFriendRequest(requestId, false);
                                setInviteState((s) => ({ ...s, [n.id]: 'declined' }));
                                if (!n.isRead) {
                                  setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                                  void markNotificationRead(n.id).catch(() => {});
                                }
                              } catch {
                                setInviteState((s) => { const next = { ...s }; delete next[n.id]; return next; });
                              }
                            }}
                            disabled={!!st}
                            className="rounded-xl bg-[var(--surface-2)] text-[var(--ink)] text-[13px] font-bold px-3.5 py-1.5 disabled:opacity-60"
                          >
                            {st === 'declining' ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Already handled — fall through to render as a regular notification.
            }

            const hasTarget = /^\/(games\/[0-9a-fA-F]{24}(\/chat)?|messages\/[0-9a-fA-F]{24}|clubs\/[a-z0-9-]+(\/posts\/[0-9a-fA-F]{24})?)$/.test(n.linkUrl || '');
            return (
              <div key={n.id} className={`notif ${!n.isRead ? 'unread' : ''} flex items-start`}>
                <button
                  className={`w-full text-left bg-transparent flex-1 min-w-0 ${hasTarget ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => open(n)}
                >
                  <div className="flex items-start" style={{ gap: '12px' }}>
                    <div className={`ic ${bgForType(n.type)}`}>
                      <Icon name={iconFor(n)} size={18} />
                    </div>
                    <div className="body">
                      <div className="head">
                        <strong>{cleanTitle(n.title)}</strong>
                        {n.body ? <> — {n.body}</> : null}
                      </div>
                      <div className="time">{relativeTime(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--coral)] mt-1"
                  aria-label="Delete notification"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            );
          })
        )}
      </DemoBranch>

      {/* ── Join Membership popup (Accept without a subscription) ─── */}
      {membershipSheet && (
        <MembershipSheet
          open
          onClose={() => setMembershipSheet(null)}
          venueName={membershipSheet.venueName}
          currency={membershipSheet.currency}
          currentPlanId={null}
          onJoin={(planId) => acceptWithPlan(planId)}
          onCancel={() => setMembershipSheet(null)}
          apiPlans={membershipSheet.plans}
        />
      )}
      </div>{/* /scrollable content */}
    </div>
  );
}
