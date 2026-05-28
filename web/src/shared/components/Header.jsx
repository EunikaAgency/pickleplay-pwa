import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Icon from './Icon.jsx';
import MobileMenu from './MobileMenu.jsx';
import MegaMenu from './MegaMenu.jsx';
import useAuth from '../../features/auth/authStore.js';

const COMPETE_ITEMS = [
  { to: '/leagues', label: 'Leagues', emoji: '🏆', desc: 'Season-long team play' },
  { to: '/tournaments', label: 'Tournaments', emoji: '🎯', desc: 'Bracket competitions' },
];

const COMMUNITY_ITEMS = [
  { to: '/clubs', label: 'Clubs', emoji: '🤝', desc: 'Join a pickle crew' },
  { to: '/coaches', label: 'Coaches', emoji: '🎓', desc: 'Lessons & clinics' },
  { to: '/learn', label: 'Learn', emoji: '📖', desc: 'Guides & tutorials' },
];

const NAV_LINKS = [
  { to: '/venues', label: 'Venues' },
  { to: '/open-play', label: 'Open Play' },
  { to: '/download', label: 'Download' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-surface-variant bg-surface-container-lowest">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-heading text-headline-md font-bold text-primary no-underline">
          pickleBaller
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex scrollbar-none">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`shrink-0 rounded-full px-2.5 py-2 text-base font-bold no-underline transition-colors xl:px-3 xl:text-base ${
                pathname.startsWith(to)
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {label}
            </Link>
          ))}
          <MegaMenu label="Compete" items={COMPETE_ITEMS} />
          <MegaMenu label="Community" items={COMMUNITY_ITEMS} />
        </nav>

        {/* Desktop right actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/search"
            className="flex touch-target items-center justify-center rounded-full text-on-surface-variant no-underline hover:bg-surface-container-high"
            aria-label="Search"
          >
            <Icon name="search" size={24} />
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/profile"
                className="flex items-center gap-2 rounded-full px-3 py-1 text-body-md font-semibold text-on-surface no-underline hover:bg-surface-container-high"
              >
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                {user.firstName}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full px-3 py-1 text-body-md font-semibold text-on-surface-variant hover:bg-surface-container-high"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-full bg-secondary-container px-6 text-body-lg font-bold text-on-secondary-container no-underline shadow-sm active:scale-95"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="flex touch-target items-center justify-center rounded-full lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Icon name="menu" size={24} />
        </button>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} links={NAV_LINKS} sections={[{ label: 'Game On', items: COMPETE_ITEMS }, { label: 'Community', items: COMMUNITY_ITEMS }]} />
    </header>
  );
}
