import { NavLink, Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import useAuth from '../auth/authStore.js';

const SECTIONS = [
  {
    label: null,
    items: [
      { to: '/admin', icon: 'dashboard', label: 'Overview', exact: true },
    ],
  },
  {
    label: 'Directory',
    items: [
      { to: '/admin/users', icon: 'people', label: 'Users' },
      { to: '/admin/venues', icon: 'stadium', label: 'Venues' },
      { to: '/admin/coaches', icon: 'sports', label: 'Coaches' },
      { to: '/admin/bookings', icon: 'event_available', label: 'Bookings' },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { to: '/admin/moderation', icon: 'gavel', label: 'Queue overview', exact: true },
      { to: '/admin/moderation/reviews', icon: 'rate_review', label: 'Reviews' },
      { to: '/admin/moderation/review-reports', icon: 'flag', label: 'Review reports' },
      { to: '/admin/moderation/claims', icon: 'assignment_ind', label: 'Venue claims' },
      { to: '/admin/moderation/suggested-edits', icon: 'edit_note', label: 'Suggested edits' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/admin/reports', icon: 'analytics', label: 'All reports', exact: true, disabled: true },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/audit-logs', icon: 'history', label: 'Audit logs', disabled: true },
      { to: '/admin/subscribers', icon: 'mail', label: 'Subscribers', disabled: true },
      { to: '/admin/tables', icon: 'table_chart', label: 'Tables', disabled: true },
    ],
  },
];

export default function AdminSidebar() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-surface-variant bg-surface-container-lowest">
      <div className="flex h-14 items-center gap-2 border-b border-surface-variant px-5">
        <Link to="/admin" className="font-heading text-lg font-bold text-primary no-underline">
          pickleBaller
        </Link>
        <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm font-bold uppercase text-on-tertiary-container">
          Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-4">
            {section.label && (
              <p className="px-4 pb-1 pt-2 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant/70">
                {section.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ to, icon, label, exact, disabled }) => (
                disabled ? (
                  <span
                    key={to}
                    title="Coming soon"
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-on-surface-variant/50"
                  >
                    <Icon name={icon} size={18} />
                    {label}
                    <span className="ml-auto rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm font-bold text-on-surface-variant">soon</span>
                  </span>
                ) : (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold no-underline transition-colors ${
                        isActive
                          ? 'bg-primary-container text-on-primary-container'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`
                    }
                  >
                    <Icon name={icon} size={18} />
                    {label}
                  </NavLink>
                )
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-surface-variant p-3">
        <div className="mb-2 flex items-center gap-2 px-2 py-1 text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="admin_panel_settings" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-on-surface">{user?.displayName || user?.firstName || user?.email}</p>
            <p className="truncate text-label-sm text-on-surface-variant">{user?.email}</p>
          </div>
        </div>
        <Link to="/dashboard/profile" className="flex items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high">
          <Icon name="person" size={18} />
          My profile
        </Link>
        <Link to="/" className="flex items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-on-surface-variant no-underline hover:bg-surface-container-high">
          <Icon name="arrow_back" size={18} />
          Back to site
        </Link>
        <button type="button" onClick={() => { logout(); window.location.href = '/'; }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-on-surface-variant hover:bg-surface-container-high">
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
