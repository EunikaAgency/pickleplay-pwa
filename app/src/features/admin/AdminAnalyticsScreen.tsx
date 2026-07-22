import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminStat, adminNumber } from './AdminScaffold';
import { listAdminUsers, listVenues, listCoaches, listAdminBookings } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

/** Platform-wide KPI totals. Uses the same live endpoints the hub uses but
 *  presented as a dedicated report page. Gated by `admin.reports.view`. */
export function AdminAnalyticsScreen({ onNavigate }: Props) {
  const [data, setData] = useState<Record<string, number>>({});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const [usersR, venuesR, coachesR, bookingsR] = await Promise.allSettled([
      listAdminUsers({ pageSize: 1 }),
      listVenues({ pageSize: 1 }),
      listCoaches(),
      listAdminBookings({ limit: 1 }),
    ]);
    if (id !== reqId.current) return;
    setData({
      users: usersR.status === 'fulfilled' ? usersR.value.length : 0,
      venues: venuesR.status === 'fulfilled' ? venuesR.value.items.length : 0,
      coaches: coachesR.status === 'fulfilled' ? coachesR.value.length : 0,
      bookings: bookingsR.status === 'fulfilled' ? bookingsR.value.length : 0,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Analytics" onRefresh={() => void load()}>
      <div className="grid grid-cols-2 gap-3 pt-4 pb-8">
        <AdminStat label="Total Users" value={adminNumber(data.users)} icon="people" tone="var(--blue)" />
        <AdminStat label="Active Venues" value={adminNumber(data.venues)} icon="stadium" tone="var(--lime-ink)" />
        <AdminStat label="Coaches" value={adminNumber(data.coaches)} icon="sports" tone="var(--amber)" />
        <AdminStat label="Bookings" value={adminNumber(data.bookings)} icon="event_available" tone="var(--coral)" />
      </div>
    </AdminScreen>
  );
}
