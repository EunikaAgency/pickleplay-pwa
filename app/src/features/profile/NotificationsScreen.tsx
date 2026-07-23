import { Fragment, useEffect, useState } from 'react';
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
    case 'booking_request_reminder':  return 'coral';
    case 'booking_request_expired':   return 'coral';
    case 'booking_rejected':          return 'coral';
    case 'booking_cancelled':         return 'coral';
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

/** Map notification types that were historically (incorrectly) used as icon
 *  names to valid Material Symbols icons. The server now stamps proper icon
 *  names, but older seed data still carries the type string. */
const TYPE_ICON_FALLBACK: Record<string, string> = {
  system: 'campaign',
  booking: 'calendar_month',
  session: 'alarm',
  review: 'reviews',
  promo: 'sell',
  coach: 'school',
};
/** The server stamps an `icon`; fall back to a bell for anything unlabelled. */
function iconFor(n: ApiNotification): string {
  const raw = n.icon || '';
  if (!raw) return 'bell';
  // If the icon looks like a notification type (not a Material Symbols name),
  // use the fallback map; otherwise pass it through.
  return TYPE_ICON_FALLBACK[raw] || raw;
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

/** Map a stored linkUrl (e.g. "/games/<id>") to an in-app navigation.
 *  `canReports` gates /owner/reports — staff get booking notifications but can't
 *  open the owner's cross-venue report, so they're sent to the front desk. */
function navigateFromLink(linkUrl: string | null | undefined, onNavigate: Navigate, canReports: boolean): boolean {
  if (!linkUrl) return false;
  // Game chat message → straight into the game's group chat, not the lobby.
  const gameChat = linkUrl.match(/^\/games\/([0-9a-fA-F]{24})\/chat$/);
  if (gameChat) { onNavigate('game-chat', { id: gameChat[1] }); return true; }
  const game = linkUrl.match(/^\/games\/([0-9a-fA-F]{24})$/);
  if (game) { onNavigate('game-details', { id: game[1] }); return true; }
  // Open Play chat message → straight into the session's group chat.
  const openPlayChat = linkUrl.match(/^\/open-play\/([0-9a-fA-F]{24})\/chat$/);
  if (openPlayChat) { onNavigate('open-play-chat', { id: openPlayChat[1] }); return true; }
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
    if (!canReports) { onNavigate('owner-front-desk', {}); return true; }
    const sp = new URLSearchParams(linkUrl.includes('?') ? linkUrl.slice(linkUrl.indexOf('?')) : '');
    onNavigate('owner-bookings', sp.get('status') ? { status: sp.get('status')! } : {});
    return true;
  }
  // The player's own bookings. Every booking notification sent to a player
  // (approved, declined, expired) points here, and none of them were routed —
  // tapping one silently did nothing.
  if (/^\/my-bookings/.test(linkUrl)) { onNavigate('my-bookings'); return true; }
  return false;
}

/** The server writes dates long-hand ("Friday, July 24, 2026 at 4:00 AM",
 *  see api `fmtDate`). At 15px in a 3-line clamp that one phrase eats the
 *  whole row, so compress it for display only — the year is dropped when it's
 *  the current one, exactly like a chat timestamp. */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LONG_DATE = /\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})\b/g;
function compactDates(text: string): string {
  const thisYear = String(new Date().getFullYear());
  return text
    .replace(LONG_DATE, (_m, dayStem: string, month: string, day: string, year: string) => {
      const mon = MONTHS.indexOf(month) >= 0 ? month.slice(0, 3) : month;
      const base = `${dayStem.slice(0, 3)} ${mon} ${day}`;
      return year === thisYear ? base : `${base}, ${year}`;
    })
    .replace(/\s+at\s+/g, ' · ');
}

/** The sentence to lead with. Titles are system labels ("Payment received —
 *  booking confirmed") that the body then restates in full; showing both is
 *  what made the old list read as a wall. The body is the human sentence, so
 *  it leads, and the title only stands in when there's no body. */
function primaryText(n: ApiNotification): string {
  return compactDates(n.body?.trim() || cleanTitle(n.title));
}

/** Short category for the meta line — the slot Facebook fills with the source
 *  page. Derived from `type`, so two notifications about one booking stay
 *  distinguishable even when their bodies match. */
const CATEGORY: Record<string, string> = {
  game_full: 'Games',
  venue_membership_invite: 'Membership',
  venue_membership_removed: 'Membership',
  booking_pending_approval: 'Bookings',
  booking_approved: 'Bookings',
  booking_request_reminder: 'Bookings',
  booking_request_expired: 'Bookings',
  booking_rejected: 'Bookings',
  booking_cancelled: 'Bookings',
  friend_request: 'Friends',
  message: 'Messages',
  tournament_message: 'Tournaments',
  alert: 'Alerts',
};
function metaLine(n: ApiNotification): string {
  const when = relativeTime(n.createdAt);
  const cat = CATEGORY[n.type || ''];
  return cat ? `${when} · ${cat}` : when;
}

/** Day bucket for the list's section headers. Calendar-day based (not
 *  elapsed hours), so a 2am notification still reads as "Today". */
function dayBucket(iso?: string): string {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  return 'Earlier';
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
    navigateFromLink(n.linkUrl, onNavigate, userHasPermission(me, 'owner.reports.view'));
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
              // A quiet tinted pill, not a solid black slab — this is a
              // secondary action sitting next to the screen title.
              <button
                onClick={markAll}
                className="rounded-full bg-[var(--primary-tint)] text-[var(--accent-rail)] text-[13px] font-extrabold px-3.5 py-2"
              >
                Mark all read
              </button>
            ) : undefined
          }
        />

        <div className="scroll-x px-5 pt-1 pb-2 flex gap-2">
          {FILTERS.map((c) => {
            // A count on the chip answers "is there anything in there?"
            // without making the user tap it. 'All' needs none.
            const n = c === 'Unread' ? unread
              : c === 'Friend Request' ? items.filter((x) => x.type === 'friend_request').length
              : 0;
            return (
              <Chip key={c} selected={filter === c} onClick={() => setFilter(c)}>
                {c}{n > 0 ? ` · ${n}` : ''}
              </Chip>
            );
          })}
        </div>

        {showPushBanner && (
          <div className="px-5 pb-2">
            <div className="push-banner rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3.5 flex items-center gap-3">
              {/* `.ic` was only ever styled under `.notif`, so this rendered as a
                  bare glyph. It gets the same disc as a notification row. */}
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
                  className="shrink-0 rounded-full bg-[var(--primary)] text-white text-[13px] font-extrabold px-4 py-2 disabled:opacity-60"
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
          <div className="notif-list">
          {(() => {
          const rowFor = (n: ApiNotification) => {
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
                      <div className="head">{primaryText(n)}</div>
                      <div className="meta">{metaLine(n)}</div>
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
                            className="rounded-full bg-[var(--primary)] text-white text-[13px] font-extrabold px-4 py-2 disabled:opacity-60"
                          >
                            {st === 'accepting' ? 'Checking…' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => respondInvite(n, false)}
                            disabled={!!st}
                            className="rounded-full bg-[var(--surface-3)] text-[var(--ink)] text-[13px] font-extrabold px-4 py-2 disabled:opacity-60"
                          >
                            {st === 'declining' ? 'Declining…' : 'Decline'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="notif-right">
                      {!n.isRead && <span className="notif-dot-unread" aria-label="Unread" />}
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
                      <div className="head">{primaryText(n)}</div>
                      <div className="meta">{metaLine(n)}</div>
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
                            className="rounded-full bg-[var(--primary)] text-white text-[13px] font-extrabold px-4 py-2 disabled:opacity-60"
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
                            className="rounded-full bg-[var(--surface-3)] text-[var(--ink)] text-[13px] font-extrabold px-4 py-2 disabled:opacity-60"
                          >
                            {st === 'declining' ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="notif-right">
                      {!n.isRead && <span className="notif-dot-unread" aria-label="Unread" />}
                    </div>
                  </div>
                );
              }
              // Already handled — fall through to render as a regular notification.
            }

            // Must stay in step with `navigateFromLink` — this only controls the
            // cursor, so when it lags behind, a row that DOES navigate renders as
            // though it doesn't. Booking + friends links were missing here.
            const hasTarget = /^\/(games\/[0-9a-fA-F]{24}(\/chat)?|messages\/[0-9a-fA-F]{24}|clubs\/[a-z0-9-]+(\/posts\/[0-9a-fA-F]{24})?|my-bookings|friends|owner\/(reports|bookings))(\?.*)?$/.test(n.linkUrl || '');
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
                      <div className="head">{primaryText(n)}</div>
                      <div className="meta">{metaLine(n)}</div>
                    </div>
                  </div>
                </button>
                <div className="notif-right">
                  {!n.isRead && <span className="notif-dot-unread" aria-label="Unread" />}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                    className="notif-x"
                    aria-label="Delete notification"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>
            );
          };
          // Day headers give a 15-row inbox somewhere to anchor the eye.
          let lastBucket = '';
          return visible.map((n) => {
            const bucket = dayBucket(n.createdAt);
            const header = bucket === lastBucket ? null : bucket;
            lastBucket = bucket;
            return (
              <Fragment key={n.id}>
                {header && <div className="notif-group">{header}</div>}
                {rowFor(n)}
              </Fragment>
            );
          });
          })()}
          </div>
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
