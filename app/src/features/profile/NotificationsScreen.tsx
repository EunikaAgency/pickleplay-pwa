import { useState, type ReactNode } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import type { Navigate, Screen } from '../../shared/lib/navigation';

interface NotificationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type IconBg = 'lime' | 'blue' | 'coral';

interface NotifItem {
  id: string;
  icon: string;
  bg: IconBg;
  unread: boolean;
  text: ReactNode;
  time: string;
  target?: Screen;
}

const INITIAL: NotifItem[] = [
  {
    id: '1',
    icon: 'check',
    bg: 'lime',
    unread: true,
    text: <><strong>Sarah K</strong> joined your <strong>Saturday Mix-In</strong></>,
    time: '2m ago',
    target: { id: 'game-details', params: { id: '1' } },
  },
  {
    id: '2',
    icon: 'message',
    bg: 'blue',
    unread: true,
    text: <><strong>Coach Mike</strong> sent a message in <strong>Game chat</strong></>,
    time: '12m ago',
    target: { id: 'game-details', params: { id: '1' } },
  },
  {
    id: '3',
    icon: 'paddle',
    bg: 'lime',
    unread: true,
    text: <>New game at <strong>Riverside</strong> matches your skill</>,
    time: '34m ago',
    target: { id: 'games' },
  },
  {
    id: '4',
    icon: 'fire',
    bg: 'coral',
    unread: false,
    text: <>You're on a <strong>4-game win streak!</strong></>,
    time: '2h ago',
  },
  {
    id: '5',
    icon: 'star',
    bg: 'blue',
    unread: false,
    text: <><strong>Alex T</strong> rated your game 5 stars</>,
    time: 'Yesterday',
  },
  {
    id: '6',
    icon: 'groups',
    bg: 'lime',
    unread: false,
    text: <><strong>Neon Smashers</strong> posted a new weekly event</>,
    time: '2 days ago',
    target: { id: 'club-details', params: { id: '1' } },
  },
];

const FILTERS = ['All', 'Mentions', 'Games', 'Clubs'];

export function NotificationsScreen({ onNavigate, onBack }: NotificationsScreenProps) {
  const [items, setItems] = useState(INITIAL);
  const [filter, setFilter] = useState('All');
  const unread = items.filter((n) => n.unread).length;

  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));

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
            onRetry={() => {}}
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
        {items.map((n) => (
          <button
            key={n.id}
            className={`notif w-full text-left bg-transparent ${n.target ? 'cursor-pointer' : 'cursor-default'} ${n.unread ? 'unread' : ''}`}
            onClick={() => {
              const t = n.target;
              if (!t) return;
              if ('params' in t) onNavigate(t.id, t.params);
              else onNavigate(t.id);
            }}
          >
            <div className={`ic ${n.bg}`}>
              <Icon name={n.icon} size={18} />
            </div>
            <div className="body">
              <div className="head">{n.text}</div>
              <div className="time">{n.time}</div>
            </div>
          </button>
        ))}
      </DemoBranch>
    </div>
  );
}
