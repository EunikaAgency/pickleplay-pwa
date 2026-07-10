import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import type { TabId } from '../../lib/navigation';
import { useAuthStore } from '../../lib/authStore';
import { useMessageStore } from '../../lib/messageStore';
import { userHasPermission, type AppUser } from '../../lib/permissions';

/** Human label for a signed-in user's role, used as the sidebar footer subtitle. */
function roleLabel(user: AppUser): string {
  if (userHasPermission(user, 'admin.access')) return 'Admin';
  if (userHasPermission(user, 'owner.access')) return 'Owner';
  if (userHasPermission(user, 'organizer.access')) return 'Organizer';
  if (userHasPermission(user, 'coach.access')) return 'Coach';
  return 'Player';
}

interface SidebarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  canCreate: boolean;
  isLoggedIn: boolean;
  /** Pop one step off the navigation history (universal back). */
  onBack: () => void;
  /** Whether there's a previous screen to return to. */
  canGoBack: boolean;
  /** Open the direct-messages screen (shown only when signed in). */
  onOpenMessages?: () => void;
  /** Open the standalone owner calendar screen. */
  onOpenCalendar?: () => void;
  /** Whether the standalone owner calendar screen is active. */
  calendarActive?: boolean;
  /** Open the standalone owner pricing screen. */
  onOpenPricing?: () => void;
  /** Whether the standalone owner pricing screen is active. */
  pricingActive?: boolean;
  /** Open the manual-reservation screen (record a phone / walk-in booking). */
  onOpenManualReservation?: () => void;
  /** Whether the manual-reservation screen is active. */
  manualReservationActive?: boolean;
  /** Open the standalone owner partners screen. */
  onOpenPartners?: () => void;
  /** Whether the standalone owner partners screen is active. */
  partnersActive?: boolean;
  /** Open the rental inventory (Shop) screen. */
  onOpenShop?: () => void;
  /** Whether the shop screen is active. */
  shopActive?: boolean;
  /** The Tournament tab is a player surface — owners/admins don't get it. */
  showTournaments?: boolean;
  /** Owners get owner-specific labels (Venues instead of Nearby, Bookings instead of Games, etc.). */
  isOwner?: boolean;
  /** Organizers get organizer-specific labels (Organize instead of Today, etc.). */
  isOrganizer?: boolean;
}

interface SideTab {
  id: TabId;
  label: string;
  icon: string;
  iconFill?: string;
}

const tabs: SideTab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Play',   icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'social',  label: 'Social', icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

// Owner labels track the owner screen each tab opens (App.tsx): home → the
// owner dashboard, games → "Bookings", nearby → "Venues" ops map.
const ownerTabs: SideTab[] = [
  { id: 'home',    label: 'Home',     icon: 'home' },
  { id: 'booking', label: 'Bookings', icon: 'calendar' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Venues',   icon: 'map_pin' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

// Organizer tabs — the organizer console home lives on the "Organize" tab.
const organizerTabs: SideTab[] = [
  { id: 'home',    label: 'Organize', icon: 'trophy' },
  { id: 'games',   label: 'Games',    icon: 'calendar' },
  { id: 'nearby',  label: 'Nearby',   icon: 'map_pin' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

export function Sidebar({ activeTab, onTabPress, onCreate, canCreate, isLoggedIn, onBack, canGoBack, onOpenMessages, onOpenCalendar, calendarActive = false, onOpenPricing, pricingActive = false, onOpenManualReservation, manualReservationActive = false, onOpenPartners, partnersActive = false, onOpenShop, shopActive = false, showTournaments = true, isOwner = false, isOrganizer = false }: SidebarProps) {
  const currentUser = useAuthStore((s) => s.user);
  const unreadMessages = useMessageStore((s) => s.unread);
  const roleTabs = isOwner ? ownerTabs : isOrganizer ? organizerTabs : tabs;
  const visibleTabs = roleTabs.filter((t) => t.id !== 'tournaments' || showTournaments);
  const showOwnerCalendar = userHasPermission(currentUser, 'owner.access') && onOpenCalendar;
  const showOwnerPricing = userHasPermission(currentUser, 'owner.access') && onOpenPricing;
  const showOwnerManualReservation = userHasPermission(currentUser, 'owner.bookings.manage') && onOpenManualReservation;
  const showOwnerPartners = userHasPermission(currentUser, 'owner.access') && onOpenPartners;
  const footName = currentUser?.displayName ?? 'Guest';
  const footSub = currentUser
    ? currentUser.skillLevel != null
      ? `DUPR ${currentUser.skillLevel}`
      : currentUser.skillLevelLabel ?? roleLabel(currentUser)
    : 'Browsing as guest';
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Icon name="paddle" size={20} />
        </span>
        <span className="brand-name">PickleBallers</span>
      </div>

      <button
        className="side-tab mb-2 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back to the previous screen"
      >
        <span className="ico">
          <Icon name="chevron" size={20} className="rotate-180" />
        </span>
        Back
      </button>

      <nav className="flex flex-col gap-1">
        {visibleTabs.map((t) => {
          const isActive = activeTab === t.id && !(t.id === 'nearby' && pricingActive) && !(t.id === 'nearby' && manualReservationActive) && !(t.id === 'nearby' && calendarActive) && !(t.id === 'nearby' && partnersActive);
          // Guests see the "Profile" tab as "Login" - tapping it sends them to sign in.
          const label = t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
          return (
            <div key={t.id} className="contents">
              <button
                className={`side-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabPress(t.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="ico">
                  <Icon name={(!isOwner && !isOrganizer) && isActive ? (t.iconFill ?? t.icon) : t.icon} size={20} />
                </span>
                {label}
              </button>
              {t.id === 'nearby' && showOwnerCalendar && (
                <button
                  className={'side-tab ' + (calendarActive ? 'active' : '')}
                  onClick={onOpenCalendar}
                  aria-current={calendarActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="calendar" size={20} />
                  </span>
                  Calendar
                </button>
              )}
              {t.id === 'nearby' && showOwnerPricing && (
                <button
                  className={`side-tab ${pricingActive ? 'active' : ''}`}
                  onClick={onOpenPricing}
                  aria-current={pricingActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="bolt" size={20} />
                  </span>
                  Pricing
                </button>
              )}
              {t.id === 'nearby' && showOwnerManualReservation && (
                <button
                  className={`side-tab ${manualReservationActive ? 'active' : ''}`}
                  onClick={onOpenManualReservation}
                  aria-current={manualReservationActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="add" size={20} />
                  </span>
                  Reservation
                </button>
              )}
              {t.id === 'nearby' && showOwnerPartners && (
                <button
                  className={`side-tab ${partnersActive ? 'active' : ''}`}
                  onClick={onOpenPartners}
                  aria-current={partnersActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="groups" size={20} />
                  </span>
                  Partners
                </button>
              )}
            </div>
          );
        })}
        {isLoggedIn && onOpenMessages && (
          <button className={`side-tab ${activeTab === 'messages' ? 'active' : ''}`} onClick={onOpenMessages} aria-current={activeTab === 'messages' ? 'page' : undefined}>
            <span className="ico">
              <Icon name="chat" size={20} />
            </span>
            Messages
            {unreadMessages > 0 && (
              <span className="side-tab-badge" aria-label={`${unreadMessages} unread messages`}>
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
        )}
        {/* Shop — owner only */}
        {isOwner && onOpenShop && (
          <button
            className={`side-tab ${shopActive ? 'active' : ''}`}
            onClick={onOpenShop}
            aria-current={shopActive ? 'page' : undefined}
          >
            <span className="ico">
              <Icon name="storefront" size={20} />
            </span>
            Shop/Rental
          </button>
        )}
        {/* Profile — placed last (very bottom of the nav) for every role. On the
            owner Shop screen the dedicated Shop item above is the active one, so
            don't also light up Profile (Shop maps to the profile tab). */}
        <button
          className={`side-tab ${activeTab === 'profile' && !shopActive ? 'active' : ''}`}
          onClick={() => onTabPress('profile')}
          aria-current={activeTab === 'profile' && !shopActive ? 'page' : undefined}
        >
          <span className="ico">
            <Icon name={(!isOwner && !isOrganizer) && activeTab === 'profile' && !shopActive ? 'user_fill' : 'user'} size={20} />
          </span>
          {isLoggedIn ? 'Profile' : 'Login'}
        </button>
      </nav>

      <button className="side-create disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreate} disabled={!canCreate}>
        <Icon name="plus" size={18} /> Create game
      </button>

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <Avatar src={currentUser?.avatarUrl} name={footName} size={36} />
        <div className="meta">
          <div className="name">{footName}</div>
          <div className="sub">{footSub}</div>
        </div>
      </div>
    </aside>
  );
}
