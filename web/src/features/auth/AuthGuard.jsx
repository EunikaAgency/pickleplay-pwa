import { Navigate, useLocation } from 'react-router-dom';
import useAuth from './authStore.js';

export default function AuthGuard({ children }) {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
