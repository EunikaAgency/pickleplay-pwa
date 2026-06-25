import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { OwnerStat } from './components/OwnerStat';
import { VenueCard } from './components/VenueCard';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { money } from '../bookings/bookingDisplay';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerVenuesScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function OwnerVenuesScreen({ onNavigate, onBack }: OwnerVenuesScreenProps) {
  const { canAnalytics, venues, status, retry, combined, statsReady, structural, glanceFor } = useOwnerDashboard();
  const currentUser = useAuthStore((s) => s.user);
  const canClaim = userHasPermission(currentUser, 'owner.venues.claim');

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Your venues"
      subtitle="Manage your listings, hours, courts and reviews."
      action={
        <div className="flex items-center gap-2">
          {canClaim && (
            <button
              type="button"
              onClick={() => onNavigate('claim-venue')}
              aria-label="Claim an existing venue"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--field-border)] text-[var(--ink)] font-bold text-[13px] active:scale-95 transition-transform"
            >
              <Icon name="verified" size={15} /> Claim
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('owner-new-venue')}
            aria-label="Create a new venue"
            className="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-bold text-[13px] active:scale-95 transition-transform"
          >
            <Icon name="plus" size={16} /> Create venue
          </button>
        </div>
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
          {canAnalytics ? (
            <>
              <div className="t-eyebrow mb-2">All venues · combined</div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <OwnerStat label="Revenue this month" value={statsReady ? money(combined.month) : '—'} icon="payments" tone="primary" />
                <OwnerStat label="Revenue this week" value={statsReady ? money(combined.week) : '—'} icon="trending_up" tone="lime" />
                <OwnerStat label="Bookings today" value={statsReady ? combined.todayBookings : '—'} icon="calendar" tone="neutral" />
                <OwnerStat label="Awaiting approval" value={statsReady ? combined.pending : '—'} icon="bell" tone="coral" />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <OwnerStat label="Venues" value={structural.total} icon="storefront" tone="primary" />
              <OwnerStat label="Claimed" value={structural.claimed} icon="check" tone="lime" />
              <OwnerStat label="Verified" value={structural.verified} icon="verified" tone="coral" />
              <OwnerStat label="Total courts" value={structural.courts} icon="paddle" tone="neutral" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {venues.map((v) => (
              <VenueCard key={v.id || v.slug} venue={v} glance={glanceFor(v)} onOpen={() => onNavigate('owner-venue', { id: v.slug || v.id })} />
            ))}
          </div>
        </div>
      )}
    </DemoBranch>
  );
}
