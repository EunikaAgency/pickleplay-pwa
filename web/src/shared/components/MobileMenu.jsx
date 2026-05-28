import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import useAuth from '../../features/auth/authStore.js';

export default function MobileMenu({ open, onClose, links, sections }) {
  const { pathname } = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-dim/60" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-72 bg-surface-container-lowest shadow-card animate-slide-up flex flex-col">
        <div className="flex items-center justify-between px-5 py-3">
          <Link to="/" className="font-heading text-headline-md font-bold text-primary no-underline" onClick={onClose}>
            pickleBaller
          </Link>
          <button
            type="button"
            className="flex touch-target items-center justify-center rounded-full"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={`rounded-full px-5 py-3 text-body-lg font-semibold no-underline ${
                pathname.startsWith(to)
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {label}
            </Link>
          ))}

          {sections?.map(section => (
            <div key={section.label} className="mt-2">
              <p className="px-5 py-1 text-label-sm font-bold uppercase text-on-surface-variant">{section.label}</p>
              {section.items.map(({ to, label, emoji }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold no-underline ${
                    pathname.startsWith(to)
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  {label}
                </Link>
              ))}
            </div>
          ))}

          <hr className="my-3 border-surface-variant" />
          <Link
            to="/search"
            onClick={onClose}
            className="flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
          >
            <Icon name="search" size={24} />
            Search
          </Link>

          {isLoggedIn ? (
            <>
              <Link
                to="/my/profile"
                onClick={onClose}
                className="flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
              >
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                {user.firstName} {user.lastName}
              </Link>
              <Link
                to="/my/bookings"
                onClick={onClose}
                className="flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
              >
                <Icon name="event_available" size={24} />
                My Bookings
              </Link>
              <Link
                to="/my/games"
                onClick={onClose}
                className="flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
              >
                <Icon name="sports_tennis" size={24} />
                My Games
              </Link>
              <Link
                to="/my/settings"
                onClick={onClose}
                className="flex items-center gap-3 rounded-full px-5 py-3 text-body-lg font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
              >
                <Icon name="settings" size={24} />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-surface-container-high text-body-lg font-bold text-on-surface-variant active:scale-95"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-secondary-container text-body-lg font-bold text-on-secondary-container no-underline active:scale-95"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
