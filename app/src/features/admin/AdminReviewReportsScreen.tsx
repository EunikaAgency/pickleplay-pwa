import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminRow, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listAdminReviewReports, resolveAdminReviewReport, type AdminReviewReport } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * Admin console: user-flagged reviews that need triaging. Resolve or dismiss
 * from the list. Gated by `admin.moderation.manage`.
 */
export function AdminReviewReportsScreen({ onNavigate }: Props) {
  const [reports, setReports] = useState<AdminReviewReport[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const data = await listAdminReviewReports();
      if (id !== reqId.current) return;
      setReports(data);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, status: 'resolved' | 'dismissed') => {
    setUpdating((u) => new Set(u).add(id));
    setErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      await resolveAdminReviewReport(id, status);
      setReports((rs) => rs.filter((r) => (r._id || r.id) !== id));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: `Could not resolve report: ${(e as Error).message}` }));
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(id); return n; });
    }
  };

  return (
    <AdminScreen onBack={() => onNavigate('admin-moderation')} title="Review reports" subtitle={`${reports.length} open report${reports.length === 1 ? '' : 's'} · User-flagged reviews that need moderation.`} onRefresh={() => void load()}>
      <AdminStates
        state={state}
        isEmpty={reports.length === 0}
        emptyIcon="flag"
        emptyTitle="No open reports"
        emptyDescription="Nothing to triage. 🎉"
      >
        <div className="space-y-3 pt-4 pb-6">
          {reports.map((r) => {
            const id = r._id || r.id || '';
            const busy = updating.has(id);
            return (
              <AdminRow
                key={id}
                icon="flag"
                iconColor="var(--coral)"
                title={r.reason || '—'}
                subtitle={
                  <span className="text-[13px]">
                    {r.details}
                    <br />
                    review #{r.reviewId?.slice(-6) ?? '—'} · reporter #{r.reporterUserId?.slice(-6) ?? '—'}
                  </span>
                }
                meta={<span className="t-sm">{adminDate(r.createdAt)}</span>}
              >
                <div className="flex gap-2 mt-3">
                  {errors[id] && <p className="mt-1 text-[13px] text-[var(--coral)]">{errors[id]}</p>}
                <button type="button" disabled={busy} onClick={() => resolve(id, 'resolved')}
                    className="chip font-bold text-[var(--lime-ink)] disabled:opacity-40">{busy ? '…' : 'Resolve'}</button>
                  <button type="button" disabled={busy} onClick={() => resolve(id, 'dismissed')}
                    className="chip font-bold text-[var(--muted)] disabled:opacity-40">{busy ? '…' : 'Dismiss'}</button>
                </div>
              </AdminRow>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
