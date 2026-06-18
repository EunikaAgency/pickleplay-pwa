import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { listNotifications, markNotificationRead, markAllNotificationsRead, type ApiNotification } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { useNotificationStore } from '../../shared/lib/notificationStore';
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
    case 'game_full': return 'lime';
    case 'message':   return 'blue';
    case 'alert':     return 'coral';
    default:          return 'blue';
  }
}

/** The server stamps an `icon`; fall back to a bell for anything unlabelled. */
function iconFor(n: ApiNotification): string {
  return n.icon || 'bell';
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
  return false;
}

const FILTERS = ['All', 'Unread'] as const;
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

  const retry = () => { setLoading(true); setError(null); setReloadKey((k) => k + 1); };

  const unread = items.filter((n) => !n.isRead).length;
  const visible = filter === 'Unread' ? items.filter((n) => !n.isRead) : items;

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

  const open = (n: ApiNotification) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); // optimistic
      void markNotificationRead(n.id).catch(() => { /* best-effort */ });
    }
    navigateFromLink(n.linkUrl, onNavigate);
  };

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Notifications"
        subtitle={`${unread} unread`}
        className="pb-3!"
        action={
          unread > 0 ? (
            <button onClick={markAll} className="more">
              Mark read
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
            title={filter === 'Unread' ? "You're all caught up" : 'No notifications yet'}
            description={
              filter === 'Unread'
                ? 'Nothing unread right now.'
                : "We'll ping you when something happens — like when your game's lobby fills up."
            }
          />
        ) : (
          visible.map((n) => {
            const hasTarget = /^\/(games\/[0-9a-fA-F]{24}(\/chat)?|messages\/[0-9a-fA-F]{24})$/.test(n.linkUrl || '');
            return (
              <button
                key={n.id}
                className={`notif w-full text-left bg-transparent ${hasTarget ? 'cursor-pointer' : 'cursor-default'} ${!n.isRead ? 'unread' : ''}`}
                onClick={() => open(n)}
              >
                <div className={`ic ${bgForType(n.type)}`}>
                  <Icon name={iconFor(n)} size={18} />
                </div>
                <div className="body">
                  <div className="head">
                    <strong>{n.title}</strong>
                    {n.body ? <> — {n.body}</> : null}
                  </div>
                  <div className="time">{relativeTime(n.createdAt)}</div>
                </div>
              </button>
            );
          })
        )}
      </DemoBranch>
    </div>
  );
}
