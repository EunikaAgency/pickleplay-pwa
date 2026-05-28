import { Outlet, NavLink, Navigate } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import Icon from '../components/ui/Icon.jsx';
import useAuth from '../stores/auth.js';

const DASHBOARD_TABS = [
  { to: '/my/profile', icon: 'person', label: 'Profile' },
  { to: '/my/bookings', icon: 'event_available', label: 'Bookings' },
  { to: '/my/games', icon: 'sports_tennis', label: 'Games' },
  { to: '/my/events', icon: 'celebration', label: 'Events' },
  { to: '/my/payments', icon: 'receipt_long', label: 'Payments' },
  { to: '/my/membership', icon: 'card_membership', label: 'Membership' },
  { to: '/my/waitlists', icon: 'list_alt', label: 'Waitlists' },
  { to: '/my/favorites', icon: 'favorite', label: 'Favorites' },
  { to: '/my/groups', icon: 'group', label: 'Groups' },
  { to: '/my/settings', icon: 'settings', label: 'Settings' },
];

export default function UserLayout() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body text-on-surface">
      <Header />
      {/* Dashboard tab bar */}
      <div className="border-b border-surface-variant bg-surface-container-lowest">
        <div className="mx-auto max-w-7xl overflow-x-auto px-5">
          <nav className="flex gap-1 py-2">
            {DASHBOARD_TABS.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-body-md font-semibold no-underline transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`
                }
              >
                <Icon name={icon} size={20} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      {/* Full-width content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
