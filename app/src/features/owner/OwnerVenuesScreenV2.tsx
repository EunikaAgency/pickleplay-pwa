import { useEffect, useMemo, useState, useCallback } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { CourtRow } from './tabs/CourtsEditorTab';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { listManagedVenues, listCourts, apiImageUrl, entityId, type ApiVenue, type OwnerCourt } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerVenuesScreenV2Props {
  onNavigate: Navigate;
  onBack: () => void;
}

const DEFAULT_SPORT = 'Pickleball';
const NO_COURTS: OwnerCourt[] = [];

/** A small summary tile (Total / Active / Hidden). */
function SummaryTile({ label, value, tone, dot }: { label: string; value: number; tone: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tone }}>{label}</span>
        <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
      </div>
      <div className="font-heading font-bold text-[26px] leading-none text-[var(--ink)] mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}

/** Feature/attribute labels shown on a court, given its flags. */
function courtFeatures(court: OwnerCourt): string[] {
  return [
    court.hasAircon && 'Aircon',
    court.highCeiling && 'High ceiling',
    court.hasRefreshmentStand && 'Refreshments',
  ].filter(Boolean) as string[];
}

function CourtCard({ court, onOpen }: { court: OwnerCourt; onOpen: () => void }) {
  const cn = court.courtNumber || '';
  const name = court.courtName || `Court ${cn}`;
  const active = court.isActive !== false;
  const sport = court.sport && court.sport !== DEFAULT_SPORT ? court.sport : DEFAULT_SPORT;
  const type = court.indoor ? 'Indoor' : court.indoor === false ? 'Outdoor' : null;
  const subtitle = [type, court.surfaceType].filter(Boolean).join(' · ') || sport;
  const img = court.mainImageUrl ? apiImageUrl(court.mainImageUrl) : null;
  const features = courtFeatures(court);

  // Status accent — green when active/bookable, coral when hidden.
  const accent = active ? '#16a34a' : 'var(--coral)';
  const statusLabel = active ? 'ACTIVE' : 'HIDDEN';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative text-left rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99]"
    >
      {/* Colored status accent bar */}
      <div className="h-1" style={{ background: accent }} />

      <div className="p-3.5">
        {/* Header: name + status pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-[15px] text-[var(--ink)] truncate">{name}</div>
            <div className="text-[12px] text-[var(--muted)] truncate mt-0.5">{subtitle}</div>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1"
            style={{ background: active ? 'rgba(22,163,74,0.12)' : 'var(--coral-soft)', color: accent }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
            {statusLabel}
          </span>
        </div>

        {/* Court illustration / photo panel */}
        <div className="mt-3 rounded-[15px] overflow-hidden bg-[var(--primary-tint)] aspect-[16/9] flex items-center justify-center">
          {img ? (
            <img src={img} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <CourtIllustration width={120} opacity={0.9} />
          )}
        </div>

        {/* Info rows — label left, value right */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--muted)]">Sport</span>
            <span className="font-semibold text-[var(--ink)]">{sport}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--muted)]">Surface</span>
            <span className="font-semibold text-[var(--ink)] truncate ml-3">{court.surfaceType || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--muted)]">Features</span>
            <span className="font-semibold text-[var(--ink)] truncate ml-3">{features.length ? features.join(' · ') : '—'}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/** The court-detail popup — shown when a court card is tapped. Embeds the real
 *  editable court accordion (`CourtRow` in `flat` mode) so the owner edits the
 *  court right here (save/delete inline) instead of jumping to the Courts tab. */
function CourtDetailSheet({ court, onClose, onSaved, onDeleted }: {
  court: OwnerCourt | null;
  onClose: () => void;
  onSaved: (c: OwnerCourt) => void;
  onDeleted: (id: string) => void;
}) {
  const name = court ? (court.courtName || `Court ${court.courtNumber || ''}`) : '';
  return (
    <BottomSheet open={!!court} onClose={onClose} title={name} subtitle="Edit court details" height="90vh">
      {court && (
        <div className="px-5">
          <CourtRow court={court} flat onSaved={onSaved} onDeleted={onDeleted} />
        </div>
      )}
    </BottomSheet>
  );
}

export function OwnerVenuesScreenV2({ onNavigate, onBack }: OwnerVenuesScreenV2Props) {
  const currentUser = useAuthStore((s) => s.user);
  const ownerId = currentUser?.id ?? '';

  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  // Courts load state is derived from a single result object that's only ever
  // set inside the async callback — never synchronously in the effect — so
  // switching venues shows a loading state without a cascading render warning.
  type CourtsResult = { venueId: string; courts: OwnerCourt[] } | { venueId: string; error: true };
  const [courtsResult, setCourtsResult] = useState<CourtsResult | null>(null);
  const matched = courtsResult?.venueId === selectedVenueId ? courtsResult : null;
  const courtsLoading = selectedVenueId !== '' && !matched;
  const courtsError = !!matched && 'error' in matched;
  const courts = matched && 'courts' in matched ? matched.courts : NO_COURTS;
  // The court whose detail popup is open (null = closed).
  const [openCourt, setOpenCourt] = useState<OwnerCourt | null>(null);

  const fetchVenues = useCallback(() => {
    if (!ownerId) return;
    setStatus('loading');
    listManagedVenues(ownerId)
      .then((v) => {
        setVenues(v);
        setSelectedVenueId((prev) => {
          if (prev && v.some((x) => (x.slug || x.id) === prev)) return prev;
          return v.length > 0 ? (v[0].slug || v[0].id) : '';
        });
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [ownerId]);

  // Load the selected venue's courts. State is set only in the async callbacks
  // (never synchronously), so this doesn't trigger a cascading-render warning.
  useEffect(() => {
    if (!selectedVenueId) return;
    let cancelled = false;
    listCourts(selectedVenueId)
      .then((c) => { if (!cancelled) setCourtsResult({ venueId: selectedVenueId, courts: c }); })
      .catch(() => { if (!cancelled) setCourtsResult({ venueId: selectedVenueId, error: true }); });
    return () => { cancelled = true; };
  }, [selectedVenueId]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  // Re-fetch the current venue's courts (event handler — safe to setState here).
  const retryCourts = () => {
    const vid = selectedVenueId;
    if (!vid) return;
    setCourtsResult(null); // → loading state; effect won't re-run (venue unchanged)
    listCourts(vid)
      .then((c) => setCourtsResult({ venueId: vid, courts: c }))
      .catch(() => setCourtsResult({ venueId: vid, error: true }));
  };

  // Reflect an inline court edit/delete from the popup back into the grid.
  const onCourtSaved = (updated: OwnerCourt) => {
    setCourtsResult((r) => (r && 'courts' in r)
      ? { ...r, courts: r.courts.map((c) => (entityId(c) === entityId(updated) ? { ...c, ...updated } : c)) }
      : r);
    setOpenCourt((o) => (o && entityId(o) === entityId(updated) ? { ...o, ...updated } : o));
  };
  const onCourtDeleted = (id: string) => {
    setCourtsResult((r) => (r && 'courts' in r) ? { ...r, courts: r.courts.filter((c) => entityId(c) !== id) } : r);
    setOpenCourt(null);
    fetchVenues(); // refresh the venue's court count in the header/dropdown
  };

  const selected = venues.find((v) => (v.slug || v.id) === selectedVenueId) ?? null;

  const counts = useMemo(() => {
    const activeCount = courts.filter((c) => c.isActive !== false).length;
    return { total: courts.length, active: activeCount, hidden: courts.length - activeCount };
  }, [courts]);

  const canClaim = userHasPermission(currentUser, 'owner.venues.claim');
  const canCreate = userHasPermission(currentUser, 'owner.venues.create');

  // The three labeled actions, shared between the two placements below.
  const actionGroup = (
    <>
      {selected && (
        <button
          type="button"
          onClick={() => onNavigate('owner-venue', { id: selected.slug || selected.id })}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px] active:scale-95 transition-transform"
        >
          <Icon name="storefront" size={15} /> Manage details
        </button>
      )}
      {canClaim && (
        <button
          type="button"
          onClick={() => onNavigate('claim-venue')}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px] active:scale-95 transition-transform"
        >
          <Icon name="verified" size={15} /> Claim
        </button>
      )}
      {canCreate && (
        <button
          type="button"
          onClick={() => onNavigate('owner-new-venue')}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-bold text-[13px] active:scale-95 transition-transform"
        >
          <Icon name="plus" size={15} /> Create
        </button>
      )}
    </>
  );

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Your courts"
      subtitle={selected ? `${selected.displayName || 'Venue'} · ${selected.courtCount ?? 0} court${selected.courtCount === 1 ? '' : 's'}` : 'Manage courts across your venues'}
      // Desktop: actions sit inline on the header row (right of the title).
      action={<div className="hidden lg:flex items-center gap-2">{actionGroup}</div>}
    />
  );

  // Mobile/tablet: the same labeled actions as a row under the title (they don't
  // fit inline next to the title on narrow widths).
  const actionButtons = (
    <div className="flex lg:hidden flex-wrap items-center gap-2 mb-4">{actionGroup}</div>
  );

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="scroll safe-top safe-bottom">
        {header}
        <ErrorState title="Couldn't load your venues" message="We couldn't reach your venues. Tap to retry." onRetry={fetchVenues} />
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <EmptyState
          icon="paddle"
          title="No venues yet"
          description="You don't own any venues on PickleBallers yet. Create one to start managing your courts."
          action={{ label: 'Create a new venue', onPress: () => onNavigate('owner-new-venue') }}
        />
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom px-5">
      {header}
      {actionButtons}

      {/* Venue selector */}
      <div className="mt-1 mb-4">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1 block">
          Venue
        </label>
        <div className="relative">
          <select
            className="w-full appearance-none h-12 pl-4 pr-10 text-[16px] font-semibold text-[var(--ink)] bg-[var(--surface)] border border-[var(--field-border)] rounded-[8px] outline-none focus:border-[var(--primary)]"
            value={selectedVenueId}
            onChange={(e) => setSelectedVenueId(e.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id || v.slug} value={v.slug || v.id}>
                {v.displayName || 'Untitled venue'} {v.isVerified ? '· Verified' : ''}
              </option>
            ))}
          </select>
          <Icon
            name="chevron"
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
        </div>
      </div>

      {/* Summary tiles */}
      {!courtsLoading && !courtsError && courts.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <SummaryTile label="Total" value={counts.total} tone="var(--ink-2)" dot="var(--muted)" />
          <SummaryTile label="Active" value={counts.active} tone="#16a34a" dot="#16a34a" />
          <SummaryTile label="Hidden" value={counts.hidden} tone="var(--coral)" dot="var(--coral)" />
        </div>
      )}

      {/* Courts grid */}
      {courtsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <LoadingSkeleton variant="card" count={4} />
        </div>
      ) : courtsError ? (
        <div className="card p-4 flex items-center justify-between gap-3">
          <span className="text-[14px] text-[var(--coral)] font-semibold">Couldn't load courts.</span>
          <button type="button" onClick={retryCourts} className="shrink-0 h-9 px-3.5 rounded-full bg-[var(--primary)] text-white font-bold text-[13px]">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {courts.map((c) => (
            <CourtCard
              key={c.id}
              court={c}
              onOpen={() => setOpenCourt(c)}
            />
          ))}
          {/* Add court card */}
          <button
            type="button"
            onClick={() => onNavigate('owner-venue', { id: selectedVenueId, tab: 'courts' })}
            className="rounded-2xl border-2 border-dashed border-[var(--field-border)] bg-[var(--surface)] flex flex-col items-center justify-center gap-2 p-6 text-center hover:border-[var(--primary)] hover:bg-[var(--primary-tint)] transition-all active:scale-[0.99] min-h-[160px]"
          >
            <span className="w-11 h-11 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
              <Icon name="plus" size={22} />
            </span>
            <div>
              <div className="font-bold text-[14px] text-[var(--primary)]">Add court</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">{courts.length === 0 ? 'Add your first court' : `Court ${courts.length + 1}`}</div>
            </div>
          </button>
        </div>
      )}


      {/* Court detail popup — the editable court accordion, inline */}
      <CourtDetailSheet
        court={openCourt}
        onClose={() => setOpenCourt(null)}
        onSaved={onCourtSaved}
        onDeleted={onCourtDeleted}
      />
    </div>
  );
}
