import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { listAdminFeedReports, resolveAdminFeedReport, type AdminFeedReport } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface AdminPostReportsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type FilterValue = 'pending' | 'resolved' | 'dismissed';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The content preview line for a reported post. */
function postPreview(post: AdminFeedReport['post']): string {
  if (!post) return 'Post removed';
  if (post.isDeleted) return 'Deleted by author';
  if (post.body) return post.body;
  return post.hasMedia ? '📷 Photo post' : '—';
}

/**
 * Admin console: review reported PickleFeed posts. Lists reports by status
 * (pending first) with the reported post, its author, who reported it, and the
 * chosen reason; a moderator can Resolve or Dismiss a pending report. The screen
 * is gated by `admin.moderation.manage` in App.tsx.
 */
export function AdminPostReportsScreen({ onNavigate: _onNavigate, onBack }: AdminPostReportsScreenProps) {
  const [filter, setFilter] = useState<FilterValue>('pending');
  const [reports, setReports] = useState<AdminFeedReport[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading');
  const reqId = useRef(0);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoadState('loading');
    try {
      const rows = await listAdminFeedReports(filter);
      if (id === reqId.current) { setReports(rows); setLoadState('idle'); }
    } catch {
      if (id === reqId.current) setLoadState('error');
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (reportId: string, status: 'resolved' | 'dismissed') => {
    setActioningId(reportId);
    setErrors((prev) => ({ ...prev, [reportId]: '' }));
    try {
      await resolveAdminFeedReport(reportId, status);
      // Drop it from the current (pending) list; on other filters just refetch.
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      setErrors((prev) => ({ ...prev, [reportId]: "Couldn't update. Try again." }));
    } finally {
      setActioningId(null);
    }
  };

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Admin console"
      title="Post reports"
      subtitle="Review PickleFeed posts players have reported."
      className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]"
      action={(
        <button type="button" onClick={() => void load()} aria-label="Refresh" className="text-[var(--muted)]">
          <Icon name="refresh" size={20} />
        </button>
      )}
    />
  );

  return (
    <div className="scroll safe-top safe-bottom px-5">
      {header}

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>
        ))}
      </div>

      {loadState === 'loading' ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : loadState === 'error' ? (
        <EmptyState icon="error" title="Couldn't load reports" description="We couldn't reach the moderation service. Check your connection and try again." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon="verified"
          title="Nothing to review"
          description={filter === 'pending' ? 'No posts are waiting for review right now.' : 'No reports match this filter.'}
        />
      ) : (
        <div className="space-y-4 pb-6">
          {reports.map((r) => {
            const busy = actioningId === r.id;
            const post = r.post;
            return (
              <section key={r.id} className="card p-4">
                {/* Reason + date */}
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold bg-[var(--coral-tint,rgba(207,48,0,0.1))] text-[var(--coral)]">
                    <Icon name="shield" size={13} /> {r.reason || 'Reported'}
                  </span>
                  <span className="t-sm shrink-0">{formatDate(r.createdAt) || '—'}</span>
                </div>

                {/* Reported post */}
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[13px] text-[var(--ink)] truncate">
                      {post?.author?.displayName ?? 'Unknown author'}
                    </div>
                  </div>
                  <p className={`mt-1 text-[14px] whitespace-pre-wrap break-words ${post?.isDeleted ? 'italic text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                    {postPreview(post)}
                  </p>
                  {post && !post.isDeleted && post.hasMedia && post.body && (
                    <div className="mt-1 t-sm">+ photo</div>
                  )}
                </div>

                {/* Reporter */}
                <div className="mt-2 t-sm">Reported by {r.reporter?.displayName ?? 'someone'}</div>

                {errors[r.id] && <p className="mt-2 text-[13px] text-[var(--coral)]">{errors[r.id]}</p>}

                {/* Actions — only for pending reports */}
                {r.status === 'pending' && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolve(r.id, 'resolved')}
                      className="px-4 py-2 rounded-xl font-bold text-[13px] bg-[var(--lime)] text-[var(--ink)] disabled:opacity-50"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolve(r.id, 'dismissed')}
                      className="px-4 py-2 rounded-xl font-bold text-[13px] border border-[var(--border)] text-[var(--muted)] disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
