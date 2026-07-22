import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminFilters, AdminSearch, AdminRow, AdminTag, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listAdminUsers, type AdminUser } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type RoleFilter = 'all' | 'player' | 'coach' | 'organizer';

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--coral)',
  owner: 'var(--blue)',
  organizer: 'var(--amber)',
  coach: 'var(--lime-ink)',
  player: 'var(--muted)',
};

function fullName(u: AdminUser): string {
  return u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—';
}

/**
 * Admin console: the Players directory. Lists player, coach, and organizer
 * accounts (owners and admins have their own pages), searchable by name/email
 * and filterable by role. Gated by `admin.users.manage`.
 */
export function AdminUsersScreen({ onNavigate, onBack: _onBack }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [role, setRole] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const rows = await listAdminUsers({ pageSize: 500 });
      if (id !== reqId.current) return;
      // The Players directory lists members who play — players, coaches, and organizers.
      setUsers(rows.filter((u) => ['player', 'coach', 'organizer'].includes(u.roleDefault || 'player')));
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c = { player: 0, coach: 0, organizer: 0 };
    for (const u of users) {
      const r = (u.roleDefault || 'player') as 'player' | 'coach' | 'organizer';
      if (r in c) c[r] += 1;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    let rows = users;
    if (role !== 'all') rows = rows.filter((u) => (u.roleDefault || 'player') === role);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((u) =>
        (u.email || '').toLowerCase().includes(q) ||
        fullName(u).toLowerCase().includes(q));
    }
    return rows;
  }, [users, role, query]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Players" subtitle={`${filtered.length} of ${users.length} accounts · Player, coach, and organizer accounts. Search by name or email, filter by role.`} onRefresh={() => void load()}>
      <AdminSearch value={query} onChange={setQuery} placeholder="Search by name or email…" />
      <AdminFilters<RoleFilter>
        value={role}
        onChange={setRole}
        filters={[
          { value: 'all', label: `All (${users.length})` },
          { value: 'player', label: `Players (${counts.player})` },
          { value: 'coach', label: `Coaches (${counts.coach})` },
          { value: 'organizer', label: `Organizers (${counts.organizer})` },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={filtered.length === 0}
        emptyIcon="people"
        emptyTitle={query ? 'No matches' : 'No players yet'}
        emptyDescription={query ? `No accounts match “${query}”.` : 'Player accounts will show up here.'}
      >
        <div className="space-y-3 pb-6">
          {filtered.map((u) => {
            const r = u.roleDefault || 'player';
            return (
              <AdminRow
                key={u._id || u.id || u.email}
                avatarUrl={u.avatarUrl || undefined}
                icon="person"
                iconColor={ROLE_COLOR[r] || 'var(--muted)'}
                title={
                  <span className="flex items-center gap-1">
                    {fullName(u)}
                    {u.isVerified && <Icon name="verified" size={15} className="text-[var(--blue)]" />}
                  </span>
                }
                subtitle={u.email}
                meta={
                  <div className="flex flex-col items-end gap-1">
                    <AdminTag label={r} color={ROLE_COLOR[r] || 'var(--muted)'} />
                    <span className="t-sm">{adminDate(u.createdAt)}</span>
                  </div>
                }
              />
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
