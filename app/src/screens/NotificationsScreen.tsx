import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useDemoState } from '../lib/demoState';

interface NotificationsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
}

const initialNotifications = [
  {
    id: '1', type: 'game_invite', title: 'Game Invite', body: 'Coach Mike invited you to Saturday Morning Mix-In',
    time: '5 min ago', read: false, icon: 'sports_tennis', iconBg: 'bg-primary/10 text-primary',
    action: { label: 'View', screen: 'game-details', params: { id: '1' } },
  },
  {
    id: '2', type: 'club_join', title: 'New Member', body: 'Sarah K. joined Neon Smashers',
    time: '1 hour ago', read: false, icon: 'group_add', iconBg: 'bg-secondary-container/30 text-on-secondary-container',
  },
  {
    id: '3', type: 'game_reminder', title: 'Game Tomorrow', body: 'Weekly Doubles League starts at 6:30 PM',
    time: '3 hours ago', read: true, icon: 'schedule', iconBg: 'bg-surface-container-high text-on-surface-variant',
    action: { label: 'View', screen: 'game-details', params: { id: '2' } },
  },
  {
    id: '4', type: 'club_announcement', title: 'New Announcement', body: 'The Kitchen Kings posted: "Sunday social this weekend!"',
    time: 'Yesterday', read: true, icon: 'campaign', iconBg: 'bg-tertiary-container/30 text-tertiary',
    action: { label: 'View', screen: 'club-details', params: { id: '1' } },
  },
  {
    id: '5', type: 'friend_request', title: 'Friend Request', body: 'Alex T. wants to add you as a favorite player',
    time: '2 days ago', read: true, icon: 'person_add', iconBg: 'bg-surface-container-high text-on-surface-variant',
  },
];

export function NotificationsScreen({ onNavigate, onBack }: NotificationsScreenProps) {
  const [items, setItems] = useState(initialNotifications);
  const hasUnread = items.some((n) => !n.read);
  const cardShadow = { boxShadow: 'var(--shadow-card)' } as const;
  const { state: demoState } = useDemoState();

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className="sticky top-0 z-40 bg-background px-5 pb-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary active:scale-95 transition-transform hover:bg-surface-container-high"
            aria-label="Back"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Notifications</h1>
        </div>
      </div>
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-3 pb-28 space-y-4">

          <div className="flex items-center justify-end mb-2">
            {hasUnread && demoState === 'normal' && (
              <button className="text-primary font-bold text-label-sm hover:underline" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {demoState === 'loading' ? (
            <LoadingSkeleton variant="list-row" count={5} />
          ) : demoState === 'error' ? (
            <ErrorState
              title="Couldn't load notifications"
              message="We couldn't reach your inbox right now. Pull down to retry or check back in a moment."
              onRetry={() => { /* no-op */ }}
            />
          ) : demoState === 'empty' ? (
            <EmptyState
              icon="notifications_none"
              title="You're all caught up"
              description="No new notifications. We'll let you know when a game invite, message, or club update arrives."
            />
          ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 p-4 rounded-[12px] transition-all cursor-pointer active:scale-[0.98] ${
                n.read ? 'bg-surface-container-lowest opacity-70' : 'bg-surface-container-lowest'
              }`}
              style={cardShadow}
              onClick={() => {
                if (n.action) onNavigate(n.action.screen, n.action.params);
              }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${n.iconBg}`}>
                <Icon name={n.icon} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-body-lg font-semibold text-on-surface">{n.title}</h3>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
                <p className="text-body-md text-on-surface-variant mt-0.5">{n.body}</p>
                <p className="text-label-sm text-outline mt-1">{n.time}</p>
              </div>
            </div>
          ))
          )}

        </main>
      </div>
    </div>
  );
}
