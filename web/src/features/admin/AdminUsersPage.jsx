import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { fetchAdminUsers } from './api.js';

const ROLE_TONE = {
  admin: 'bg-error-container text-on-error-container',
  owner: 'bg-primary-container text-on-primary-container',
  coach: 'bg-tertiary-container text-on-tertiary-container',
  player: 'bg-surface-container-high text-on-surface-variant',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAdminUsers({ limit: 500, signal: ctrl.signal })
      .then((data) => { setUsers(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => {
    let rows = users;
    if (roleFilter !== 'all') rows = rows.filter((u) => (u.roleDefault || 'player') === roleFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((u) =>
        (u.email || '').toLowerCase().includes(needle) ||
        (u.displayName || '').toLowerCase().includes(needle) ||
        (u.firstName || '').toLowerCase().includes(needle) ||
        (u.lastName || '').toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [users, q, roleFilter]);

  const counts = useMemo(() => {
    const c = { admin: 0, owner: 0, coach: 0, player: 0 };
    for (const u of users) c[u.roleDefault || 'player'] = (c[u.roleDefault || 'player'] || 0) + 1;
    return c;
  }, [users]);

  const columns = [
    {
      key: 'displayName',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <Icon name="person" size={18} />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-on-surface">{u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}</p>
            <p className="truncate text-label-sm text-on-surface-variant">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roleDefault',
      header: 'Role',
      render: (u) => {
        const role = u.roleDefault || 'player';
        return <span className={`rounded-full px-3 py-0.5 text-label-sm font-bold uppercase ${ROLE_TONE[role] || ROLE_TONE.player}`}>{role}</span>;
      },
    },
    {
      key: 'isVerified',
      header: 'Verified',
      render: (u) => u.isVerified ? <Icon name="verified" size={20} className="text-primary" /> : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (u) => u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : <span className="text-on-surface-variant">·</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-on-surface">Users</h1>
          <p className="mt-1 text-on-surface-variant">
            {loading ? 'Loading…' : `${filtered.length} of ${users.length}`} accounts
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
        <div className="relative flex-1 min-w-[240px]">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            aria-label="Search users"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {[
            { id: 'all', label: `All (${users.length})` },
            { id: 'player', label: `Player (${counts.player || 0})` },
            { id: 'coach', label: `Coach (${counts.coach || 0})` },
            { id: 'owner', label: `Owner (${counts.owner || 0})` },
            { id: 'admin', label: `Admin (${counts.admin || 0})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRoleFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-base font-semibold transition-colors ${
                roleFilter === opt.id ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        emptyMessage={q ? `No users match "${q}".` : 'No users yet.'}
        rowKey="_id"
      />
    </div>
  );
}
