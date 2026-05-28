import { NavLink, Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';

const ADMIN_ITEMS = [
  { to: '/admin/venues', icon: 'stadium', label: 'Venues' },
  { to: '/admin/users', icon: 'people', label: 'Users' },
  { to: '/admin/games', icon: 'sports_tennis', label: 'Games' },
  { to: '/admin/clubs', icon: 'group', label: 'Clubs' },
  { to: '/admin/content', icon: 'article', label: 'Content' },
  { to: '/admin/reports', icon: 'flag', label: 'Reports' },
  { to: '/admin/analytics', icon: 'analytics', label: 'Analytics' },
];

export default function AdminSidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-surface-variant bg-surface-container-lowest">
      <div className="flex h-14 items-center border-b border-surface-variant px-5">
        <Link to="/admin" className="font-heading text-headline-md font-bold text-primary no-underline">
          pickleBaller
        </Link>
        <span className="ml-2 rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm font-bold uppercase text-on-tertiary-container">
          Admin
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {ADMIN_ITEMS.map(({ to, icon, label }) => (
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

      <div className="mt-auto border-t border-surface-variant p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-body-md font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high"
        >
          <Icon name="arrow_back" size={20} />
          Back to Site
        </Link>
      </div>
    </aside>
  );
}
