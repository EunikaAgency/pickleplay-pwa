import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminStat, adminNumber } from './AdminScaffold';
import { listAdminUsers, listAdminBookings, listVenues, listCoaches } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission, type Permission } from '../../shared/lib/permissions';
import type { Navigate, ScreenId } from '../../shared/lib/navigation';

interface AdminHubScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

interface SectionItem {
  screen: ScreenId;
  icon: string;
  label: string;
  description: string;
  permission?: Permission;
}

// The console's navigation, grouped like the website's admin sidebar. Each item
// is gated by a permission; items the signed-in admin can't use are hidden.
const SECTIONS: { label: string; items: SectionItem[] }[] = [
  {
    label: 'Directory',
    items: [
      { screen: 'admin-users', icon: 'people', label: 'Players', description: 'Player + coach accounts', permission: 'admin.users.manage' },
      { screen: 'admin-venues', icon: 'stadium', label: 'Venues', description: 'Every venue in the directory', permission: 'admin.venues.manage' },
      { screen: 'admin-owners', icon: 'storefront', label: 'Owners', description: 'Owners + their venues', permission: 'admin.venues.manage' },
      { screen: 'admin-coaches', icon: 'sports', label: 'Coaches', description: 'The coach directory', permission: 'admin.users.manage' },
      { screen: 'admin-bookings', icon: 'event_available', label: 'Bookings', description: 'Court bookings report', permission: 'admin.bookings.manage' },
      { screen: 'admin-games', icon: 'sports_tennis', label: 'Games', description: 'Games + open play', permission: 'admin.access' },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { screen: 'admin-moderation', icon: 'gavel', label: 'Queue overview', description: 'Open items across every queue', permission: 'admin.moderation.manage' },
      { screen: 'admin-reviews', icon: 'rate_review', label: 'Reviews', description: 'Reviews awaiting moderation', permission: 'admin.moderation.manage' },
      { screen: 'admin-review-reports', icon: 'flag', label: 'Review reports', description: 'User-flagged reviews', permission: 'admin.moderation.manage' },
      { screen: 'admin-post-reports', icon: 'report', label: 'Post reports', description: 'User-flagged PickleFeed posts', permission: 'admin.moderation.manage' },
      { screen: 'admin-claims', icon: 'assignment_ind', label: 'Venue claims', description: 'Ownership claims to verify', permission: 'admin.moderation.manage' },
      { screen: 'admin-venue-approvals', icon: 'fact_check', label: 'Venue approvals', description: 'New venues to publish', permission: 'admin.moderation.manage' },
      { screen: 'admin-suggested-edits', icon: 'edit_note', label: 'Suggested edits', description: 'User venue corrections', permission: 'admin.moderation.manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { screen: 'admin-settings', icon: 'settings', label: 'Settings', description: 'Payments + email monitoring', permission: 'admin.settings.manage' },
      { screen: 'admin-roles', icon: 'shield_person', label: 'Roles & permissions', description: 'What each role can do', permission: 'admin.settings.manage' },
    ],
  },
];

type Counts = { users: number | null; venues: number | null; coaches: number | null; bookings: number | null };

/**
 * Admin console home — the mobile port of the website's admin dashboard. Shows
 * live platform KPIs and a permission-filtered menu into every admin surface.
 * Gated by `admin.access` in App.tsx.
 */
export function AdminHubScreen({ onNavigate, onBack }: AdminHubScreenProps) {
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState<Counts>({ users: null, venues: null, coaches: null, bookings: null });
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const [usersR, venuesR, coachesR, bookingsR] = await Promise.allSettled([
      listAdminUsers({ pageSize: 500 }),
      listVenues({ pageSize: 500 }),
      listCoaches(),
      listAdminBookings({ limit: 500 }),
    ]);
    if (id !== reqId.current) return;
    setCounts({
      users: usersR.status === 'fulfilled' ? usersR.value.length : null,
      venues: venuesR.status === 'fulfilled' ? venuesR.value.items.length : null,
      coaches: coachesR.status === 'fulfilled' ? coachesR.value.length : null,
      bookings: bookingsR.status === 'fulfilled' ? bookingsR.value.length : null,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const can = (p?: Permission) => !p || userHasPermission(user, p);

  return (
    <AdminScreen onBack={onBack} title="Admin console" subtitle="Platform overview — live totals and quick access to every admin surface." onRefresh={() => void load()}>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <AdminStat label="Users" value={counts.users == null ? '—' : adminNumber(counts.users)} icon="people" tone="var(--blue)" />
        <AdminStat label="Venues" value={counts.venues == null ? '—' : adminNumber(counts.venues)} icon="stadium" tone="var(--lime-ink)" />
        <AdminStat label="Coaches" value={counts.coaches == null ? '—' : adminNumber(counts.coaches)} icon="sports" tone="var(--amber)" />
        <AdminStat label="Bookings" value={counts.bookings == null ? '—' : adminNumber(counts.bookings)} icon="event_available" tone="var(--coral)" />
      </div>

      {/* Quick actions — the full nav lives in the sidebar/drawer */}
      <div className="pt-6 pb-8">
        <div className="lbl mb-2">Quick actions</div>
        <div className="grid grid-cols-2 gap-3">
          {SECTIONS.flatMap((s) => s.items).filter((it) => can(it.permission)).slice(0, 4).map((it) => (
            <button
              key={it.screen}
              type="button"
              onClick={() => onNavigate(it.screen as 'admin-users')}
              className="card p-4 flex flex-col items-center gap-2 text-center"
            >
              <span className="shrink-0 size-10 rounded-full flex items-center justify-center bg-[var(--surface-2,rgba(0,0,0,0.05))] text-[var(--blue)]">
                <Icon name={it.icon} size={20} />
              </span>
              <span className="hd-3">{it.label}</span>
            </button>
          ))}
        </div>
        <p className="t-sm mt-4 text-center">Full navigation in the sidebar menu or drawer.</p>
      </div>
    </AdminScreen>
  );
}
