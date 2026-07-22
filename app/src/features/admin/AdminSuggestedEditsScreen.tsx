import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminRow, AdminTag, AdminStates, adminDate, type LoadState } from './AdminScaffold';
import { listAdminSuggestedEdits, reviewSuggestedEdit, type AdminSuggestedEdit } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--amber)',
  accepted: 'var(--lime-ink)',
  rejected: 'var(--coral)',
};

/** Serialise a suggested edit's payload for preview. */
function payloadPreview(payload: unknown): string {
  if (typeof payload === 'string') return payload.slice(0, 200);
  try { return JSON.stringify(payload, null, 0).slice(0, 200); } catch { return String(payload).slice(0, 200); }
}

function venueName(e: AdminSuggestedEdit): string {
  return e.venueName || (typeof e.venueId === 'object' && e.venueId != null ? (e.venueId as Record<string, string>).displayName : null) || 'Unknown venue';
}

function submitterName(e: AdminSuggestedEdit): string {
  if (e.submitterName) return e.submitterName;
  if (typeof e.suggestedByUserId === 'object' && e.suggestedByUserId != null) return (e.suggestedByUserId as Record<string, string>).displayName || '—';
  return '—';
}

/**
 * Admin console: user-submitted venue corrections. Accept or reject edits from
 * the list. Gated by `admin.moderation.manage`.
 */
export function AdminSuggestedEditsScreen({ onNavigate }: Props) {
  const [edits, setEdits] = useState<AdminSuggestedEdit[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const data = await listAdminSuggestedEdits();
      if (id !== reqId.current) return;
      setEdits(data);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (id: string, status: 'accepted' | 'rejected') => {
    setUpdating((u) => new Set(u).add(id));
    setErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      await reviewSuggestedEdit(id, status);
      setEdits((es) => es.map((e) => (e._id || e.id) === id ? { ...e, status } : e));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: `Could not update edit: ${(e as Error).message}` }));
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(id); return n; });
    }
  };

  return (
    <AdminScreen onBack={() => onNavigate('admin-moderation')} title="Suggested edits" subtitle={`${edits.length} total · User-submitted venue corrections. Accept or reject.`} onRefresh={() => void load()}>
      <AdminStates
        state={state}
        isEmpty={edits.length === 0}
        emptyIcon="edit_note"
        emptyTitle="No suggested edits"
        emptyDescription="Nothing to review."
      >
        <div className="space-y-3 pt-4 pb-6">
          {edits.map((e) => {
            const id = e._id || e.id || '';
            const busy = updating.has(id);
            const s = e.status || 'pending';
            const isPending = s === 'pending';
            return (
              <AdminRow
                key={id}
                icon="edit_note"
                title={venueName(e)}
                subtitle={
                  <div className="text-[13px]">
                    <span className="chip font-semibold">{e.editType || 'edit'}</span> by {submitterName(e)}
                    <pre className="mt-1.5 rounded-lg bg-[var(--surface-2,rgba(0,0,0,0.03))] p-2 text-[12px] leading-tight overflow-hidden text-ellipsis">{payloadPreview(e.payloadJson)}</pre>
                  </div>
                }
                meta={
                  <div className="flex flex-col items-end gap-1">
                    <AdminTag label={s} color={STATUS_COLOR[s] || 'var(--muted)'} />
                    <span className="t-sm">{adminDate(e.createdAt)}</span>
                  </div>
                }
              >
                {isPending && (
                  <div className="flex gap-2 mt-3">
                    {errors[id] && <p className="mt-1 text-[13px] text-[var(--coral)]">{errors[id]}</p>}
                    <button type="button" disabled={busy} onClick={() => review(id, 'accepted')}
                      className="chip font-bold text-[var(--lime-ink)] disabled:opacity-40">{busy ? '…' : 'Accept'}</button>
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
