import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminSearch, AdminRow, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listAdminOwners, type AdminOwner } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * Admin console: venue owners and the venues they own. Searchable by owner,
 * email, or venue name. Gated by `admin.venues.manage`.
 */
export function AdminOwnersScreen({ onNavigate }: Props) {
  const [owners, setOwners] = useState<AdminOwner[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const rows = await listAdminOwners();
      if (id !== reqId.current) return;
      setOwners(rows);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const venueCount = useMemo(() => owners.reduce((sum, o) => sum + (o.venues?.length || 0), 0), [owners]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((o) =>
      (o.email || '').toLowerCase().includes(q) ||
      (o.displayName || '').toLowerCase().includes(q) ||
      (o.venues || []).some((v) => (v.name || '').toLowerCase().includes(q)));
  }, [owners, query]);

  return (
    <AdminScreen
      onBack={() => onNavigate('admin-hub')}
      title="Owners"
      subtitle={`${owners.length} owner${owners.length === 1 ? '' : 's'} · ${venueCount} venue${venueCount === 1 ? '' : 's'}`}
      onRefresh={() => void load()}
    >
      <AdminSearch value={query} onChange={setQuery} placeholder="Search owner, email, or venue…" />
      <div className="pt-3" />
      <AdminStates
        state={state}
        isEmpty={filtered.length === 0}
        emptyIcon="storefront"
        emptyTitle={query ? 'No matches' : 'No owners yet'}
        emptyDescription={query ? `No owners match “${query}”.` : 'Assign an owner to a venue and they will appear here.'}
      >
        <div className="space-y-3 pb-6">
          {filtered.map((o) => {
            const venues = o.venues || [];
            return (
              <AdminRow
                key={o.id || o._id || o.email}
                icon="storefront"
                title={
                  <span className="flex items-center gap-1">
                    {o.displayName || '—'}
                    {o.isVerified && <Icon name="verified" size={15} className="text-[var(--blue)]" />}
                  </span>
                }
                subtitle={o.email}
                meta={<span className="t-sm">{adminDate(o.createdAt)}</span>}
              >
                <div className="mt-3">
                  <div className="lbl mb-1.5">{venues.length} {venues.length === 1 ? 'venue' : 'venues'}</div>
                  {venues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {venues.map((v) => (
                        <span key={v.id} className="chip text-[13px] font-semibold">{v.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </AdminRow>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
