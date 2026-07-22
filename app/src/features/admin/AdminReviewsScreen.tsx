import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminFilters, AdminRow, AdminTag, AdminStates, type LoadState } from './AdminScaffold';
import { listAdminReviews, moderateAdminReview, type AdminReview } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type StatusFilter = 'pending_moderation' | 'approved' | 'rejected' | 'hidden';

const STATUS_COLOR: Record<string, string> = {
  pending_moderation: 'var(--amber)',
  approved: 'var(--lime-ink)',
  rejected: 'var(--coral)',
  hidden: 'var(--muted)',
};

/**
 * Admin console: venue/coach reviews awaiting moderation. Approve/reject/hide
 * rows directly from list. Gated by `admin.moderation.manage`.
 */
export function AdminReviewsScreen({ onNavigate }: Props) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<StatusFilter>('pending_moderation');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const data = await listAdminReviews(filter);
      if (id !== reqId.current) return;
      setReviews(data);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const moderate = async (id: string, status: 'approved' | 'rejected' | 'hidden') => {
    setUpdating((u) => new Set(u).add(id));
    try {
      await moderateAdminReview(id, status);
      setReviews((rs) => rs.filter((r) => (r._id || r.id) !== id));
    } catch (e) {
      alert(`Could not ${status} review: ${(e as Error).message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(id); return n; });
    }
  };

  return (
    <AdminScreen onBack={() => onNavigate('admin-moderation')} title="Review moderation" subtitle={`${reviews.length} ${filter.replace(/_/g, ' ')}`} onRefresh={() => void load()}>
      <AdminFilters<StatusFilter>
        value={filter}
        onChange={setFilter}
        filters={[
          { value: 'pending_moderation', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'hidden', label: 'Hidden' },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={reviews.length === 0}
        emptyIcon="rate_review"
        emptyTitle={`No ${filter.replace(/_/g, ' ')} reviews`}
        emptyDescription="Nothing here right now."
      >
        <div className="space-y-3 pb-6">
          {reviews.map((r) => {
            const id = r._id || r.id || '';
            const busy = updating.has(id);
            return (
              <AdminRow
                key={id}
                icon="rate_review"
                title={<span>{'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))} · {r.rating}</span>}
                subtitle={
                  <span className="text-[13px]">
                    {r.text || <em className="text-[var(--muted)]">(no text)</em>}
                    <br />
                    venue #{r.venueId?.slice(-6) ?? '—'} · user #{r.userId?.slice(-6) ?? '—'}
                  </span>
                }
                meta={<AdminTag label={r.status || 'pending_moderation'} color={STATUS_COLOR[r.status || 'pending_moderation']} />}
              >
                {filter === 'pending_moderation' && (
                  <div className="flex gap-2 mt-3">
                    <button type="button" disabled={busy} onClick={() => moderate(id, 'approved')}
                      className="chip font-bold text-[var(--lime-ink)] disabled:opacity-40">
                      {busy ? '…' : 'Approve'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => moderate(id, 'rejected')}
                      className="chip font-bold text-[var(--coral)] disabled:opacity-40">
                      {busy ? '…' : 'Reject'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => moderate(id, 'hidden')}
                      className="chip font-bold text-[var(--muted)] disabled:opacity-40">
                      {busy ? '…' : 'Hide'}
                    </button>
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
