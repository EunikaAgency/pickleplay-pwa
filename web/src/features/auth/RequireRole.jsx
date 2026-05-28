import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from './authStore.js';

// Route guard that requires (a) login and (b) one of the named roles.
// Usage as layout element:
//   { element: <RequireRole role="admin" />, children: [...] }
// Usage wrapping children:
//   <RequireRole role={['owner', 'admin']}><MyPage /></RequireRole>
//
// `role` accepts a string or array. Falls back to user.roleDefault if
// modePreference isn't set.
export default function RequireRole({ role, children }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);
  const user = useAuth((s) => s.user);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  const allowed = Array.isArray(role) ? role : [role];
  const userRole = user?.role || user?.roleDefault || 'player';
  // Admins implicitly pass any role check.
  const ok = userRole === 'admin' || allowed.includes(userRole);

  if (!ok) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl">🚧</div>
        <h1 className="mt-4 font-heading text-2xl font-extrabold">Access denied</h1>
        <p className="mt-2 text-on-surface-variant">
          You need <strong>{allowed.join(' or ')}</strong> permissions to view this area.
        </p>
        <a href="/dashboard/profile" className="mt-4 font-bold text-primary no-underline hover:underline">Back to your dashboard</a>
      </div>
    );
  }

  return children ?? <Outlet />;
}
