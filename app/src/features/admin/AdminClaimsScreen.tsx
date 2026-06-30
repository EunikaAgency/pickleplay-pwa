import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { listClaims, reviewClaim, apiImageUrl, ApiError, type VenueClaim } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface AdminClaimsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type FilterValue = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'all';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'needs_info', label: 'Needs info' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

// Status → label + token colour, shared between the chip and the card heading.
const STATUS_META: Record<VenueClaim['status'], { label: string; color: string }> = {
  pending: { label: 'Pending review', color: 'var(--amber)' },
  approved: { label: 'Approved', color: 'var(--lime-ink)' },
  rejected: { label: 'Rejected', color: 'var(--coral)' },
  needs_info: { label: 'More info needed', color: 'var(--blue)' },
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Resolve a proof-document reference to an openable href. Uploaded files are
// stored as API media paths (resolved via apiImageUrl); typed proof links are
// already absolute URLs.
function docHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : (apiImageUrl(url) || url);
}

/**
 * Admin console: review venue-ownership claims. Lists claims filtered by status
 * (pending first) and lets a moderator approve / reject / request more info on a
 * pending claim, with an optional note that the API relays to the claimant. The
 * screen is gated by `admin.moderation.manage` in App.tsx.
 */
export function AdminClaimsScreen({ onBack }: AdminClaimsScreenProps) {
  const [filter, setFilter] = useState<FilterValue>('pending');
  const [claims, setClaims] = useState<VenueClaim[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading');
  const reqId = useRef(0);

  // Per-claim review-in-progress UI state.
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoadState('loading');
    try {
      const rows = await listClaims(filter === 'all' ? undefined : filter);
      if (id === reqId.current) { setClaims(rows); setLoadState('idle'); }
    } catch {
      if (id === reqId.current) setLoadState('error');
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const review = async (claimId: string, status: 'approved' | 'rejected' | 'needs_info') => {
    setActioningId(claimId);
    setErrors((prev) => ({ ...prev, [claimId]: '' }));
    try {
      await reviewClaim(claimId, { status, reviewNotes: notes[claimId]?.trim() || undefined });
      await load();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [claimId]: err instanceof ApiError && err.status === 409
          ? 'This claim was already reviewed — refresh to see its latest status.'
          : 'Could not save your decision. Try again in a moment.',
      }));
    } finally {
      setActioningId(null);
    }
  };

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Admin console"
      title="Venue claims"
      subtitle="Review ownership claims submitted by venue owners."
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
        <EmptyState icon="error" title="Couldn't load claims" description="We couldn't reach the claims service. Check your connection and try again." />
      ) : claims.length === 0 ? (
        <EmptyState
          icon="verified"
          title="Nothing to review"
          description={filter === 'pending' ? 'No claims are waiting for review right now.' : 'No claims match this filter.'}
        />
      ) : (
        <div className="space-y-4 pb-6">
          {claims.map((c) => {
            const claimId = c.id || c._id || '';
            const meta = STATUS_META[c.status];
            const busy = actioningId === claimId;
            const note = notes[claimId] ?? '';
            return (
              <section key={claimId} className="card p-4">
                {/* Venue + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="hd-3 truncate">{c.venueName || 'Unknown venue'}</div>
                    <div className="t-sm">Submitted {formatDate(c.createdAt) || '—'}</div>
                  </div>
                  <span className="text-[12px] font-bold shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                </div>

                {/* Claimant identity */}
                <dl className="mt-3 space-y-1.5">
                  <Field label="Account" value={c.claimantName} />
                  <Field label="Legal name" value={c.claimantLegalName} />
                  <Field label="Role at venue" value={c.claimantRole} />
                  <Field label="Contact" value={c.claimantContact} />
                </dl>

                {/* Proof */}
                <div className="mt-3">
                  <div className="lbl">How they're connected</div>
                  <p className="text-[14px] text-[var(--ink)] whitespace-pre-wrap mt-0.5">{c.proofDescription}</p>
                </div>

                {c.proofDocumentUrls && c.proofDocumentUrls.length > 0 && (
                  <div className="mt-3">
                    <div className="lbl">Proof documents</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.proofDocumentUrls.map((url, i) => (
                        <a key={url} href={docHref(url)} target="_blank" rel="noreferrer noopener" className="chip text-[13px] font-semibold">
                          <Icon name="description" size={14} /> Document {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* A previously-recorded reviewer note (e.g. on a needs_info/rejected claim). */}
                {c.reviewNotes && c.status !== 'pending' && (
                  <div className="mt-3 text-[13px] font-semibold text-[var(--muted)]">
                    Your note: {c.reviewNotes}
                  </div>
                )}

                {/* Review actions — only a pending claim is actionable; the others
                    are awaiting the claimant (needs_info) or already decided. */}
                {c.status === 'pending' && (
                  <div className="mt-4 border-t-[0.5px] border-[var(--hairline)] pt-4">
                    <label className="lbl">Note to the claimant (optional, required to request more info)</label>
                    <textarea
                      className="control"
                      rows={2}
                      value={note}
                      maxLength={1000}
                      disabled={busy}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [claimId]: e.target.value }))}
                      placeholder="e.g. Please upload a business permit, or a staff email we can verify."
                    />
                    {errors[claimId] && <div className="t-sm text-[var(--coral)] font-bold mt-2">{errors[claimId]}</div>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button onClick={() => review(claimId, 'approved')} disabled={busy}>
                        {busy ? 'Saving…' : 'Approve'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => review(claimId, 'needs_info')}
                        disabled={busy || note.trim().length === 0}
                        className="chip font-semibold disabled:opacity-40"
                      >
                        Request more info
                      </button>
                      <button
                        type="button"
                        onClick={() => review(claimId, 'rejected')}
                        disabled={busy}
                        className="chip font-semibold text-[var(--coral)]"
                      >
                        Reject
                      </button>
                    </div>
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

// One label/value line in the claimant-identity block; renders a muted dash when
// the claimant left the field blank.
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2 text-[14px]">
      <dt className="text-[var(--muted)] font-semibold shrink-0 w-[110px]">{label}</dt>
      <dd className="text-[var(--ink)] min-w-0 break-words">{value || '—'}</dd>
    </div>
  );
}
