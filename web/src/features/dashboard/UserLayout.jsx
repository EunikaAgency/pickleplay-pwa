import { useEffect } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import Header from '../../shared/components/Header.jsx';
import Icon from '../../shared/components/Icon.jsx';
import useAuth from '../auth/authStore.js';

const DASHBOARD_TABS = [
  { to: '/dashboard/profile', icon: 'person', label: 'Profile' },
  { to: '/dashboard/bookings', icon: 'event_available', label: 'Bookings' },
  { to: '/dashboard/games', icon: 'sports_tennis', label: 'Games' },
  { to: '/dashboard/events', icon: 'celebration', label: 'Events' },
  { to: '/dashboard/payments', icon: 'receipt_long', label: 'Payments' },
  { to: '/dashboard/membership', icon: 'card_membership', label: 'Membership' },
  { to: '/dashboard/waitlists', icon: 'list_alt', label: 'Waitlists' },
  { to: '/dashboard/favorites', icon: 'favorite', label: 'Favorites' },
  { to: '/dashboard/groups', icon: 'group', label: 'Groups' },
  { to: '/dashboard/settings', icon: 'settings', label: 'Settings' },
];

export default function UserLayout() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);
  const refreshMe = useAuth((s) => s.refreshMe);
  const location = useLocation();

  // Re-validate the cached session on every entry to /dashboard/*. Silently
  // logs out if the stored token is no longer valid.
  useEffect(() => {
    if (isLoggedIn) refreshMe();
  }, [isLoggedIn, refreshMe]);

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
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
