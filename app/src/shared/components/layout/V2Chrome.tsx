import type { ReactNode } from 'react';
import type { Navigate, TabId } from '../../lib/navigation';
import { useNotificationStore } from '../../lib/notificationStore';
import { useMessageStore } from '../../lib/messageStore';

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
  const unreadMessages = useMessageStore((s) => s.unread);
  return (
    <header className="v2c-topnav">
      <div className="v2c-inner">
        {onBack ? (
          <button className="v2c-iconbtn v2c-back" aria-label="Go back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          {isLoggedIn && (
            <button className="v2c-iconbtn" aria-label="Messages" onClick={() => onNavigate('messages')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {isLoggedIn && unreadMessages > 0 && (
                <span className="v2c-notif-badge" aria-label={`${unreadMessages} unread messages`}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          )}
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
  tournaments: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>),
  clubs: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  messages: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
  profile: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
};
const TAB_LABELS: Record<TabId, string> = { home: 'Home', nearby: 'Map', games: 'Games', tournaments: 'Tournament', clubs: 'Clubs', messages: 'Messages', profile: 'Profile' };

// The full tab order. `tabIds` (from App, role-derived) may drop some — e.g.
// owners/admins don't get the player Tournament tab.
const DEFAULT_TAB_ORDER: TabId[] = ['home', 'nearby', 'games', 'tournaments', 'clubs', 'profile'];

// The v2.1 tab bar renders the player tabs — Home · Nearby · Games · Tournament · Clubs ·
// Profile. Creating a game lives on the floating green FAB instead (see V2Fab).
export function V2TabBar({ activeTab, onTabPress, tabIds = DEFAULT_TAB_ORDER }: { activeTab: TabId; onTabPress: (tab: TabId) => void; tabIds?: TabId[] }) {
  return (
    <nav className="v2c-tabbar" aria-label="Primary navigation">
      {tabIds.map((id) => {
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            className={`v2c-tab${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onTabPress(id)}
          >
            {TAB_ICONS[id]}
            <span className="v2c-tab-label">{TAB_LABELS[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}

// The floating green FAB shows pending Open Play invites. It opens the invites
// view in the Games tab so the user can accept/decline them. Hidden when there
// are no pending invites.
export function V2Fab({ onClick, count = 0 }: { onClick: () => void; count?: number }) {
  const label = count > 0 ? `Invites (${count})` : 'Invites';
  return (
    <button className="v2c-fab" aria-label={label} onClick={onClick}>
      {/* Pickleball backdrop — lime ball with holes + a soft highlight. */}
      <svg className="v2c-fab-ball" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="var(--lime)" stroke="#20243A" strokeWidth="3" />
        <circle cx="36" cy="50" r="2.6" fill="#20243A" opacity=".5" />
        <circle cx="50" cy="36" r="2.6" fill="#20243A" opacity=".5" />
        <circle cx="64" cy="50" r="2.6" fill="#20243A" opacity=".5" />
        <circle cx="50" cy="64" r="2.6" fill="#20243A" opacity=".5" />
        <ellipse cx="36" cy="33" rx="12" ry="7" fill="#fff" opacity=".35" />
      </svg>
      <span className="v2c-fab-label">Invites</span>
      {count > 0 && (
        <span className="v2c-fab-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>
      )}
    </button>
  );
}

/** The chrome/handlers App hands to every v2 tab screen. */
export interface V2ScreenChrome {
  activeTab: TabId;
  onNavigate: Navigate;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  /** Opens the booking-first Open Play flow for explicit host/create CTAs. */
  onHost: () => void;
  /** Opens the Open Play invites view (the floating "Invites" FAB target). */
  onInvites: () => void;
  isLoggedIn: boolean;
  /** Soft auth gate for inline commit actions (join game/club); returns true if allowed. */
  requireAuth: (intent: string) => boolean;
  /** App's absolute history back (pops the nav stack); the universal header binds to it. */
  onBack: () => void;
  /** True when there's a recorded previous screen — drives the header back arrow's visibility. */
  canGoBack: boolean;
  /** Pending Open Play invites — badges the floating "Invites" FAB when &gt; 0. */
  inviteCount?: number;
  /** Which bottom-nav tabs to show (role-derived in App — e.g. owners/admins
   *  don't get the player Tournament tab). Defaults to all when omitted. */
  tabIds?: TabId[];
  /** When true, V2Shell suppresses its own bottom tab bar — used when the
   *  classic TabBar (owner/organizer) provides the mobile bottom nav instead. */
  suppressTabBar?: boolean;
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
  /** Suppress the header back arrow even when there's history (e.g. the Home root). */
  hideBack?: boolean;
  children: ReactNode;
}

/**
 * Wraps a v2 screen's content in the `.pb-v2.v2-<screen>` scope plus the shared
 * top nav / FAB / tab bar. Tab screens get the FAB + tab bar; create/detail
 * flows pass `hideTabBar`/`hideFab` and an `onBack`.
 */
export function V2Shell({ screen, chrome, onBack, title, hideTabBar, hideFab, hideBack, children }: V2ShellProps) {
  // An explicit `onBack` (create/detail flows, e.g. the wizard's step-aware Prev)
  // wins; otherwise fall back to the app's absolute history back, shown only when
  // there's somewhere to go back to (hidden on a fresh cold-start tab). `hideBack`
  // forces it off — used by root tab screens (e.g. Home) where a back arrow is odd.
  const back = hideBack ? undefined : (onBack ?? (chrome.canGoBack ? chrome.onBack : undefined));
  return (
    <div className={`pb-v2 ${screen}`}>
      <V2TopNav onNavigate={chrome.onNavigate} isLoggedIn={chrome.isLoggedIn} onBack={back} title={title} />
      <main>{children}</main>
      {!hideFab && !chrome.suppressTabBar && (chrome.inviteCount ?? 0) > 0 && <V2Fab onClick={chrome.onInvites} count={chrome.inviteCount} />}
      {!hideTabBar && !chrome.suppressTabBar && <V2TabBar activeTab={chrome.activeTab} onTabPress={chrome.onTabPress} tabIds={chrome.tabIds} />}
    </div>
  );
}
