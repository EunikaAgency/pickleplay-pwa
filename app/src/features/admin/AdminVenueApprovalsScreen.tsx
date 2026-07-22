import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminRow, AdminTag, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listPendingVenues, reviewVenueApproval, type PendingVenue } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

const LISTING_COLOR: Record<string, string> = {
  pending: 'var(--amber)',
  published: 'var(--lime-ink)',
  rejected: 'var(--coral)',
};

/**
 * Admin console: owner-submitted venues awaiting listing approval. Approve
 * (publish) or reject from the list. Gated by `admin.moderation.manage`.
 */
export function AdminVenueApprovalsScreen({ onNavigate }: Props) {
  const [venues, setVenues] = useState<PendingVenue[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const data = await listPendingVenues();
      if (id !== reqId.current) return;
      setVenues(data);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setUpdating((u) => new Set(u).add(id));
    try {
      await reviewVenueApproval(id, status);
      setVenues((vs) => vs.map((v) => (v._id || v.id) === id ? { ...v, listingStatus: status === 'approved' ? 'published' : 'rejected' } : v));
    } catch (e) {
      alert(`Could not update venue: ${(e as Error).message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(id); return n; });
    }
  };

  const pendingCount = venues.filter((v) => (v.listingStatus || 'pending') === 'pending').length;

  return (
    <AdminScreen onBack={() => onNavigate('admin-moderation')} title="Venue approvals" subtitle={`${pendingCount} awaiting review`} onRefresh={() => void load()}>
      <AdminStates
        state={state}
        isEmpty={venues.length === 0}
        emptyIcon="fact_check"
        emptyTitle="No venues awaiting approval"
        emptyDescription="All caught up."
      >
        <div className="space-y-3 pt-4 pb-6">
          {venues.map((v) => {
            const id = v._id || v.id || '';
            const busy = updating.has(id);
            const s = v.listingStatus || 'pending';
            const isPending = s === 'pending';
            return (
              <AdminRow
                key={id}
                icon="stadium"
                title={v.displayName || 'Untitled venue'}
                subtitle={
                  <span className="text-[13px]">
                    {[v.area, v.cityName].filter(Boolean).join(', ') || '—'}<br />
                    {v.ownerName || '—'}{v.ownerEmail ? ` · ${v.ownerEmail}` : ''}
                  </span>
                }
                meta={
                  <div className="flex flex-col items-end gap-1">
                    <AdminTag label={s} color={LISTING_COLOR[s] || 'var(--muted)'} />
                    <span className="t-sm">{adminDate(v.createdAt)}</span>
                  </div>
                }
              >
                {isPending && (
                  <div className="flex gap-2 mt-3">
                    <button type="button" disabled={busy} onClick={() => review(id, 'approved')}
                      className="chip font-bold text-[var(--lime-ink)] disabled:opacity-40">{busy ? '…' : 'Approve'}</button>
                    <button type="button" disabled={busy} onClick={() => review(id, 'rejected')}
                      className="chip font-bold text-[var(--coral)] disabled:opacity-40">{busy ? '…' : 'Reject'}</button>
                  </div>
                )}
              </AdminRow>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
