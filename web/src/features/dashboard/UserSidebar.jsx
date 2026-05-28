import { NavLink } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';

const SIDEBAR_ITEMS = [
  { to: '/dashboard/bookings', icon: 'event_available', label: 'My Bookings' },
  { to: '/dashboard/games', icon: 'sports_tennis', label: 'My Games' },
  { to: '/dashboard/events', icon: 'celebration', label: 'My Events' },
  { to: '/dashboard/payments', icon: 'receipt_long', label: 'Payments' },
  { to: '/dashboard/membership', icon: 'card_membership', label: 'Membership' },
  { to: '/dashboard/waitlists', icon: 'list_alt', label: 'Waitlists' },
  { to: '/dashboard/favorites', icon: 'favorite', label: 'Favorites' },
  { to: '/dashboard/groups', icon: 'group', label: 'Groups' },
  { to: '/dashboard/profile', icon: 'person', label: 'Profile' },
  { to: '/dashboard/settings', icon: 'settings', label: 'Settings' },
];

export default function UserSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-20 flex flex-col gap-1">
        {SIDEBAR_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-full px-4 py-2.5 text-body-md font-semibold no-underline transition-colors ${
                isActive
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`
            }
          >
            <Icon name={icon} size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
