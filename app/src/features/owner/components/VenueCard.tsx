import { Icon } from '../../../shared/components/ui/Icon';
import { locationLine } from '../../../shared/lib/venueDisplay';
import { money } from '../../bookings/bookingDisplay';
import type { ApiVenue } from '../../../shared/lib/api';
import type { Glance } from '../hooks/useOwnerDashboard';

const CARD_GRADIENT = 'linear-gradient(135deg, #0040e0, #6c83ff)';

// Owner venue tile — image/state badges, name/location, court count, plus an
// optional business glance (today's bookings / pending / today's revenue).
// Shared by OwnerVenuesScreen and OwnerHomeScreen.
export function VenueCard({ venue, onOpen, glance }: { venue: ApiVenue; onOpen: () => void; glance: Glance | null }) {
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
        {glance && (
          <div className="mt-2.5 pt-2.5 border-t-[0.5px] border-[var(--hairline)] flex items-center gap-3 text-[12px]">
            <span className="text-[var(--muted)]"><span className="font-bold text-[var(--ink)] tabular-nums">{glance.todayCount}</span> today</span>
            {glance.pendingCount > 0 && <span className="font-bold text-[var(--coral)] tabular-nums">{glance.pendingCount} pending</span>}
            <span className="ml-auto text-[var(--muted)]"><span className="font-bold text-[var(--ink)] tabular-nums">{money(glance.todayRevenue)}</span> today</span>
          </div>
        )}
      </div>
    </button>
  );
}
