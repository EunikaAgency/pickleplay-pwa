import { useState, type ReactNode } from 'react';
import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useDemoState } from '../lib/demoState';

interface NotificationsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
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
  action?: { screen: string; params?: Record<string, string> };
}

const INITIAL: NotifItem[] = [
  {
    id: '1',
    icon: 'check',
    bg: 'lime',
    unread: true,
    text: <><strong>Sarah K</strong> joined your <strong>Saturday Mix-In</strong></>,
    time: '2m ago',
    action: { screen: 'game-details', params: { id: '1' } },
  },
  {
    id: '2',
    icon: 'message',
    bg: 'blue',
    unread: true,
    text: <><strong>Coach Mike</strong> sent a message in <strong>Game chat</strong></>,
    time: '12m ago',
    action: { screen: 'game-details', params: { id: '1' } },
  },
  {
    id: '3',
    icon: 'paddle',
    bg: 'lime',
    unread: true,
    text: <>New game at <strong>Riverside</strong> matches your skill</>,
    time: '34m ago',
    action: { screen: 'games' },
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
    action: { screen: 'club-details', params: { id: '1' } },
  },
];

const FILTERS = ['All', 'Mentions', 'Games', 'Clubs'];

export function NotificationsScreen({ onNavigate, onBack }: NotificationsScreenProps) {
  const [items, setItems] = useState(INITIAL);
  const [filter, setFilter] = useState('All');
  const { state: demoState } = useDemoState();
  const unread = items.filter((n) => n.unread).length;

  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));

  return (
    <div className="scroll" style={{ paddingBottom: 40, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="back" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="hd-2">Notifications</div>
          <div className="t-sm">{unread} unread</div>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="more">
            Mark read
          </button>
        )}
      </div>

      <div className="scroll-x" style={{ padding: '4px 20px 8px', display: 'flex', gap: 8 }}>
        {FILTERS.map((c) => (
          <Chip key={c} selected={filter === c} onClick={() => setFilter(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {demoState === 'loading' ? (
        <div style={{ padding: '0 20px' }}>
          <LoadingSkeleton variant="list-row" count={5} />
        </div>
      ) : demoState === 'error' ? (
        <ErrorState
          title="Couldn't load notifications"
          message="We couldn't reach your inbox. Try again in a moment."
          onRetry={() => {}}
        />
      ) : demoState === 'empty' ? (
        <EmptyState
          icon="bell"
          title="You're all caught up"
          description="No new notifications. We'll ping you when something happens."
        />
      ) : (
        items.map((n) => (
          <button
            key={n.id}
            className={`notif ${n.unread ? 'unread' : ''}`}
            style={{ background: 'transparent', width: '100%', textAlign: 'left', cursor: n.action ? 'pointer' : 'default' }}
            onClick={() => n.action && onNavigate(n.action.screen, n.action.params)}
          >
            <div className={`ic ${n.bg}`}>
              <Icon name={n.icon} size={18} />
            </div>
            <div className="body">
              <div className="head">{n.text}</div>
              <div className="time">{n.time}</div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
