import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, AdminFilters, AdminSearch, AdminRow, AdminTag, AdminStates, type LoadState } from './AdminScaffold';
import { listVenues, apiImageUrl, type ApiVenue } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type StateFilter = 'all' | 'claimed' | 'unclaimed';

const STATE_COLOR: Record<string, string> = {
  claimed: 'var(--blue)',
  unclaimed: 'var(--muted)',
  delisted: 'var(--coral)',
};

function venueState(v: ApiVenue): string {
  return v.state || 'unclaimed';
}

function locationLine(v: ApiVenue): string {
  return [v.city || v.area, v.region].filter(Boolean).join(' · ') || '—';
}

/**
 * Admin console: the venue directory. Every venue in the platform, searchable
 * by name/city and filterable by claim state. Reuses the public venues endpoint
 * with a large page size. Gated by `admin.venues.manage`.
 */
export function AdminVenuesScreen({ onNavigate }: Props) {
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<StateFilter>('all');
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const page = await listVenues({ pageSize: 500 });
      if (id !== reqId.current) return;
      setVenues(page.items);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c = { claimed: 0, unclaimed: 0 };
    for (const v of venues) {
      const s = venueState(v);
      if (s === 'claimed') c.claimed += 1; else c.unclaimed += 1;
    }
    return c;
  }, [venues]);

  const filtered = useMemo(() => {
    let rows = venues;
    if (filter !== 'all') rows = rows.filter((v) => (venueState(v) === 'claimed' ? 'claimed' : 'unclaimed') === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((v) =>
        (v.displayName || '').toLowerCase().includes(q) ||
        (v.city || '').toLowerCase().includes(q) ||
        (v.region || '').toLowerCase().includes(q) ||
        (v.slug || '').toLowerCase().includes(q));
    }
    return rows;
  }, [venues, filter, query]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Venues" subtitle={`${filtered.length} of ${venues.length} venues · Every venue on the platform. Search by name, city, or slug.`} onRefresh={() => void load()}>
      <AdminSearch value={query} onChange={setQuery} placeholder="Search by name, city, or slug…" />
      <AdminFilters<StateFilter>
        value={filter}
        onChange={setFilter}
        filters={[
          { value: 'all', label: `All (${venues.length})` },
          { value: 'claimed', label: `Claimed (${counts.claimed})` },
          { value: 'unclaimed', label: `Unclaimed (${counts.unclaimed})` },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={filtered.length === 0}
        emptyIcon="stadium"
        emptyTitle={query ? 'No matches' : 'No venues yet'}
        emptyDescription={query ? `No venues match “${query}”.` : 'Venues will appear here.'}
      >
        <div className="space-y-3 pb-6">
          {filtered.map((v) => {
            const s = venueState(v);
            const img = v.image || v.mainImageUrl;
            return (
              <AdminRow
                key={v.id}
                avatarUrl={img ? apiImageUrl(img) : undefined}
                icon="stadium"
                title={
                  <span className="flex items-center gap-1">
                    {v.displayName}
                    {v.isVerified && <Icon name="verified" size={15} className="text-[var(--blue)]" />}
                  </span>
                }
                subtitle={locationLine(v)}
                meta={
                  <div className="flex flex-col items-end gap-1">
                    <AdminTag label={s} color={STATE_COLOR[s] || 'var(--muted)'} />
                    <span className="t-sm">
                      {v.courtCount != null ? `${v.courtCount} court${v.courtCount === 1 ? '' : 's'}` : ''}
                      {v.priceFrom != null ? ` · ${v.pricingCurrency || '₱'}${v.priceFrom}` : ''}
                    </span>
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
