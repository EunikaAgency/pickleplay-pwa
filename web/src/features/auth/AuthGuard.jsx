import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from './authStore.js';

// Drop-in wrapper for routes that require an authenticated user.
// Works either as a layout element (renders <Outlet />) or wrapping children.
//
// Usage in router.jsx:
//   { element: <AuthGuard />, children: [...] }      // route element
//   <AuthGuard><MyPage /></AuthGuard>                // wrap children
export default function AuthGuard({ children }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return children ?? <Outlet />;
}
