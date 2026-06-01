import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { OwnerStat } from './OwnerStat';
import { useAuthStore } from '../../shared/lib/authStore';
import { listOwnerVenues, type ApiVenue } from '../../shared/lib/api';
import { locationLine } from '../../shared/lib/venueDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerVenuesScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const CARD_GRADIENT = 'linear-gradient(135deg, #0040e0, #6c83ff)';

function VenueCard({ venue, onOpen }: { venue: ApiVenue; onOpen: () => void }) {
  const state = venue.state || 'unclaimed';
  return (
    <button type="button" onClick={onOpen} className="card p-0 text-left w-full">
      <div className="relative h-28" style={{ background: CARD_GRADIENT }}>
        {venue.image ? (
          <img src={venue.image} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40">
            <Icon name="paddle" size={40} />
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--primary-deep)]">{state}</span>
          {venue.isVerified && <span className="rounded-full bg-[var(--lime)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--lime-ink)]">Verified</span>}
        </div>
      </div>
      <div className="p-3.5">
        <div className="font-heading font-semibold text-[16px] text-[var(--ink)]">{venue.displayName}</div>
        <div className="mt-0.5 flex items-center gap-1 t-sm">
          <Icon name="location" size={13} /> {locationLine(venue) || '—'}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[13px] text-[var(--muted)]">
            <Icon name="paddle" size={14} /> {venue.courtCount ?? 0} courts
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-[var(--primary)]">
            Manage <Icon name="forward" size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function OwnerVenuesScreen({ onNavigate, onBack }: OwnerVenuesScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const ownerId = currentUser?.id ?? '';
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    listOwnerVenues(ownerId)
      .then((v) => {
        if (cancelled) return;
        setVenues(v);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const retry = () => {
    setStatus('loading');
    listOwnerVenues(ownerId)
      .then((v) => {
        setVenues(v);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  const stats = useMemo(() => {
    const claimed = venues.filter((v) => v.state === 'claimed').length;
    const verified = venues.filter((v) => v.isVerified).length;
    const courts = venues.reduce((sum, v) => sum + (v.courtCount || 0), 0);
    return { total: venues.length, claimed, verified, courts };
  }, [venues]);

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Your venues"
      subtitle="Manage your listings, hours, courts and reviews."
      action={
        <button
          type="button"
          onClick={() => onNavigate('owner-new-venue')}
          aria-label="Create a new venue"
          className="w-9 h-9 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center"
        >
          <Icon name="plus" size={18} />
        </button>
      }
    />
  );

  const loadingUI = (
    <div className="scroll safe-top safe-bottom px-5">
      {header}
      <LoadingSkeleton variant="card" count={4} />
    </div>
  );
  const errorUI = (
    <div className="scroll safe-top safe-bottom">
      {header}
      <ErrorState title="Couldn't load your venues" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
    </div>
  );
  const emptyUI = (
    <div className="scroll safe-top safe-bottom px-5">
      {header}
      <EmptyState
        icon="paddle"
        title="No venues yet"
        description="You don't own any venues on PickleBallers yet. Create one to start managing your listing, hours, courts and reviews."
        action={{ label: 'Create a new venue', onPress: () => onNavigate('owner-new-venue') }}
      />
    </div>
  );

  return (
    <DemoBranch loading={loadingUI} error={errorUI} empty={emptyUI}>
      {status === 'loading' ? (
        loadingUI
      ) : status === 'error' ? (
        errorUI
      ) : venues.length === 0 ? (
        emptyUI
      ) : (
        <div className="scroll safe-top safe-bottom px-5">
          {header}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <OwnerStat label="Venues" value={stats.total} icon="storefront" tone="primary" />
            <OwnerStat label="Claimed" value={stats.claimed} icon="check" tone="lime" />
            <OwnerStat label="Verified" value={stats.verified} icon="verified" tone="coral" />
            <OwnerStat label="Total courts" value={stats.courts} icon="paddle" tone="neutral" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {venues.map((v) => (
              <VenueCard key={v.id || v.slug} venue={v} onOpen={() => onNavigate('owner-venue', { id: v.slug || v.id })} />
            ))}
          </div>
        </div>
      )}
    </DemoBranch>
  );
}
