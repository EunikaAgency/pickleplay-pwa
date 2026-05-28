import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar.jsx';

// Auth + admin-role enforcement happens at the router level via
// <RequireRole role="admin" />. By the time AdminLayout renders, the user
// is guaranteed to be an authenticated admin.
export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background font-body text-on-surface">
      <AdminSidebar />
      <main className="flex-1 overflow-x-hidden p-8">
        <Outlet />
      </main>
    </div>
  );
}
