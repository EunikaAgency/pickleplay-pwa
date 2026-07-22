import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminSearch, AdminRow, AdminTag, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listAdminUsers, type AdminUser } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

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
 * Admin console: the Players directory. Lists player accounts (coach and
 * organizer are subscription-based, not account roles — see the Partner
 * Subscriptions admin page for those). Searchable by name/email. Gated by
 * `admin.users.manage`.
 */
export function AdminUsersScreen({ onNavigate, onBack: _onBack }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const rows = await listAdminUsers({ pageSize: 500 });
      if (id !== reqId.current) return;
      // Players only — coach/organizer are subscription-based, not account roles.
      setUsers(rows.filter((u) => (u.roleDefault || 'player') === 'player'));
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(q) ||
      fullName(u).toLowerCase().includes(q));
  }, [users, query]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Players" subtitle={`${filtered.length} of ${users.length} accounts · Player accounts. Search by name or email.`} onRefresh={() => void load()}>
      <AdminSearch value={query} onChange={setQuery} placeholder="Search by name or email…" />
      <AdminStates
        state={state}
        isEmpty={filtered.length === 0}
        emptyIcon="people"
        emptyTitle={query ? 'No matches' : 'No players yet'}
        emptyDescription={query ? `No accounts match "${query}".` : 'Player accounts will show up here.'}
      >
        <div className="space-y-3 pb-6">
          {filtered.map((u) => {
            const r = u.roleDefault || 'player';
            const uid = u._id || u.id || '';
            return (
              <button key={u._id || u.id || u.email} type="button" className="w-full text-left" onClick={() => onNavigate('player-profile', { id: uid })}>
                <AdminRow
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
              </button>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
