import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminFilters, AdminSearch, AdminRow, AdminStates, type LoadState } from './AdminScaffold';
import { listCoaches, apiImageUrl, type ApiCoach } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type CoachFilter = 'all' | 'verified' | 'unverified';

/**
 * Admin console: the coach directory, searchable by name/location and
 * filterable by verification. Reuses the public coaches endpoint.
 * Gated by `admin.users.manage`.
 */
export function AdminCoachesScreen({ onNavigate }: Props) {
  const [coaches, setCoaches] = useState<ApiCoach[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<CoachFilter>('all');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const rows = await listCoaches();
      if (id !== reqId.current) return;
      setCoaches(rows);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const verifiedCount = useMemo(() => coaches.filter((c) => c.isVerified).length, [coaches]);

  const filtered = useMemo(() => {
    let rows = coaches;
    if (filter === 'verified') rows = rows.filter((c) => c.isVerified);
    if (filter === 'unverified') rows = rows.filter((c) => !c.isVerified);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) =>
        (c.displayName || '').toLowerCase().includes(q) ||
        (c.location || c.cityPrimary || '').toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q));
    }
    return rows;
  }, [coaches, filter, query]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Coaches" subtitle={`${filtered.length} of ${coaches.length} coaches`} onRefresh={() => void load()}>
      <AdminSearch value={query} onChange={setQuery} placeholder="Search by name, location, or slug…" />
      <AdminFilters<CoachFilter>
        value={filter}
        onChange={setFilter}
        filters={[
          { value: 'all', label: `All (${coaches.length})` },
          { value: 'verified', label: `Verified (${verifiedCount})` },
          { value: 'unverified', label: `Unverified (${coaches.length - verifiedCount})` },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={filtered.length === 0}
        emptyIcon="sports"
        emptyTitle={query ? 'No matches' : 'No coaches yet'}
        emptyDescription={query ? `No coaches match “${query}”.` : 'Coaches will appear here.'}
      >
        <div className="space-y-3 pb-6">
          {filtered.map((c) => {
            const img = c.avatarUrl || c.imageUrl;
            return (
              <AdminRow
                key={c.id}
                avatarUrl={img ? apiImageUrl(img) : undefined}
                icon="sports"
                iconColor="var(--lime-ink)"
                title={
                  <span className="flex items-center gap-1">
                    {c.displayName}
                    {c.isVerified && <Icon name="verified" size={15} className="text-[var(--blue)]" />}
                  </span>
                }
                subtitle={c.location || c.cityPrimary || '—'}
                meta={
                  <div className="flex flex-col items-end gap-1">
                    {c.rating != null && c.rating > 0 ? (
                      <span className="flex items-center gap-0.5 text-[13px] font-bold">
                        <Icon name="star" size={13} className="text-[var(--blue)]" />{c.rating}
                        <span className="t-sm ml-0.5">({c.reviewCount || 0})</span>
                      </span>
                    ) : <span className="t-sm">no reviews</span>}
                    {c.rateFrom != null && <span className="t-sm">{c.priceCurrency || '₱'}{c.rateFrom}+</span>}
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
