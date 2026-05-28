import { Outlet, Navigate } from 'react-router-dom';
import AdminSidebar from '../components/layout/AdminSidebar.jsx';
import useAuth from '../stores/auth.js';

export default function AdminLayout() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background font-body text-on-surface">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
