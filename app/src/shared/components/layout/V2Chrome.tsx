import type { ReactNode } from 'react';
import type { Navigate, TabId } from '../../lib/navigation';
import { useNotificationStore } from '../../lib/notificationStore';

/**
 * Shared chrome for the v2.1 player design: a sticky top nav, the bottom tab bar
 * (with the lime active-dot), the floating create FAB, and a `V2Shell` wrapper
 * that ties them together around a screen's content. Ports of the mockup markup,
 * wired to the app's real navigation.
 *
 * Uses dedicated `v2c-*` classes (styled in shared/styles/v2.css) so it never
 * collides with the per-screen ported styles. The shell renders the
 * `.pb-v2.v2-<screen>` wrapper, so chrome + content inherit the v2 tokens/fonts.
 * The app's own TabBar/Sidebar are hidden while v2 is active (see App.tsx).
 */

interface TopNavProps {
  onNavigate: Navigate;
  isLoggedIn: boolean;
  onBack?: () => void;
  title?: string;
}

export function V2TopNav({ onNavigate, isLoggedIn, onBack, title }: TopNavProps) {
  const unread = useNotificationStore((s) => s.unread);
  return (
    <header className="v2c-topnav">
      <div className="v2c-inner">
        {onBack ? (
          <button className="v2c-iconbtn" aria-label="Go back" onClick={onBack}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 40 }} aria-hidden="true" />
        )}

        <button className="v2c-brand" onClick={() => onNavigate('home')} aria-label="PickleBallers home">
          {title ?? (<>Pickle<span>Ballers</span></>)}
        </button>

        <div className="v2c-actions">
          <button className="v2c-iconbtn" aria-label="Notifications" onClick={() => onNavigate('notifications')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {isLoggedIn && unread > 0 && (
              <span className="v2c-notif-badge" aria-label={`${unread} unread notifications`}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

const TAB_ICONS: Record<TabId, ReactNode> = {
  home: (<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>),
  nearby: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>),
  games: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
  clubs: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  profile: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
};
const TAB_LABELS: Record<TabId, string> = { home: 'Home', nearby: 'Nearby', games: 'Games', clubs: 'Clubs', profile: 'Profile' };
const TAB_ORDER: TabId[] = ['home', 'nearby', 'games', 'clubs', 'profile'];

export function V2TabBar({ activeTab, onTabPress }: { activeTab: TabId; onTabPress: (tab: TabId) => void }) {
  return (
    <nav className="v2c-tabbar" aria-label="Primary navigation">
      {TAB_ORDER.map((tab) => (
        <button
          key={tab}
          className={`v2c-tab${tab === activeTab ? ' active' : ''}`}
          aria-current={tab === activeTab ? 'page' : undefined}
          onClick={() => onTabPress(tab)}
        >
          {TAB_ICONS[tab]}
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}

export function V2Fab({ onClick, label = 'Create a game' }: { onClick: () => void; label?: string }) {
  return (
    <button className="v2c-fab" aria-label={label} onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

/** The chrome/handlers App hands to every v2 tab screen. */
export interface V2ScreenChrome {
  activeTab: TabId;
  onNavigate: Navigate;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  isLoggedIn: boolean;
  /** Soft auth gate for inline commit actions (join game/club); returns true if allowed. */
  requireAuth: (intent: string) => boolean;
  /** App's absolute history back (pops the nav stack); the universal header binds to it. */
  onBack: () => void;
  /** True when there's a recorded previous screen — drives the header back arrow's visibility. */
  canGoBack: boolean;
}

export interface V2ShellProps {
  /** Per-screen scope class, e.g. 'v2-home'. */
  screen: string;
  /** The chrome bundle App hands every v2 screen. */
  chrome: V2ScreenChrome;
  /** Detail/form screens show a back arrow + hide the tab bar. */
  onBack?: () => void;
  title?: string;
  hideTabBar?: boolean;
  hideFab?: boolean;
  children: ReactNode;
}

/**
 * Wraps a v2 screen's content in the `.pb-v2.v2-<screen>` scope plus the shared
 * top nav / FAB / tab bar. Tab screens get the FAB + tab bar; create/detail
 * flows pass `hideTabBar`/`hideFab` and an `onBack`.
 */
export function V2Shell({ screen, chrome, onBack, title, hideTabBar, hideFab, children }: V2ShellProps) {
  // An explicit `onBack` (create/detail flows, e.g. the wizard's step-aware Prev)
  // wins; otherwise fall back to the app's absolute history back, shown only when
  // there's somewhere to go back to (hidden on a fresh cold-start tab).
  const back = onBack ?? (chrome.canGoBack ? chrome.onBack : undefined);
  return (
    <div className={`pb-v2 ${screen}`}>
      <V2TopNav onNavigate={chrome.onNavigate} isLoggedIn={chrome.isLoggedIn} onBack={back} title={title} />
      <main>{children}</main>
      {!hideFab && <V2Fab onClick={chrome.onCreate} />}
      {!hideTabBar && <V2TabBar activeTab={chrome.activeTab} onTabPress={chrome.onTabPress} />}
    </div>
  );
}
