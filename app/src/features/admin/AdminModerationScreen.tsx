import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, adminNumber } from './AdminScaffold';
import {
  listAdminReviews, listAdminReviewReports, listAdminFeedReports,
  listClaims, listAdminSuggestedEdits,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * Moderation queue overview — shows open-item counts for each moderation
 * surface and links into the dedicated queue pages. Gated by `admin.moderation.manage`.
 */
export function AdminModerationScreen({ onNavigate }: Props) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const [reviewsR, reportsR, postR, claimsR, editsR] = await Promise.allSettled([
      listAdminReviews().then(d => d.length).catch(() => null),
      listAdminReviewReports().then(d => d.length).catch(() => null),
      listAdminFeedReports('pending').then(d => d.length).catch(() => null),
      listClaims('pending').then(d => d.length).catch(() => null),
      listAdminSuggestedEdits().then(d => d.length).catch(() => null),
    ]);
    if (id !== reqId.current) return;
    setCounts({
      reviews: reviewsR.status === 'fulfilled' ? reviewsR.value : null,
      reports: reportsR.status === 'fulfilled' ? reportsR.value : null,
      postReports: postR.status === 'fulfilled' ? postR.value : null,
      claims: claimsR.status === 'fulfilled' ? claimsR.value : null,
      edits: editsR.status === 'fulfilled' ? editsR.value : null,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const queues = [
    { id: 'admin-reviews', icon: 'rate_review', label: 'Reviews', desc: 'Awaiting moderation', key: 'reviews', tone: 'var(--blue)' },
    { id: 'admin-review-reports', icon: 'flag', label: 'Review reports', desc: 'User-flagged reviews', key: 'reports', tone: 'var(--coral)' },
    { id: 'admin-post-reports', icon: 'report', label: 'Post reports', desc: 'Reported PickleFeed posts', key: 'postReports', tone: 'var(--coral)' },
    { id: 'admin-claims', icon: 'assignment_ind', label: 'Venue claims', desc: 'Ownership to verify', key: 'claims', tone: 'var(--lime-ink)' },
    { id: 'admin-suggested-edits', icon: 'edit_note', label: 'Suggested edits', desc: 'Venue corrections', key: 'edits', tone: 'var(--amber)' },
  ] as const;

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Moderation queues" onRefresh={() => void load()}>
      <div className="space-y-3 pt-4 pb-8">
        {queues.map((q) => {
          const c = counts[q.key];
          return (
            <button key={q.id} type="button" onClick={() => onNavigate(q.id as 'admin-reviews')} className="w-full card p-4 flex items-center gap-3 text-left">
              <span className="shrink-0 size-10 rounded-full flex items-center justify-center bg-[var(--surface-2,rgba(0,0,0,0.05))]" style={{ color: q.tone }}>
                <Icon name={q.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="hd-3 block truncate">{q.label}</span>
                <span className="t-sm block truncate">{q.desc}</span>
              </span>
              <span className="hd-2 tabular-nums" style={{ color: q.tone }}>{c == null ? '…' : adminNumber(c)}</span>
              <Icon name="chevron_right" size={20} className="text-[var(--muted)] shrink-0" />
            </button>
          );
        })}
      </div>
    </AdminScreen>
  );
}
