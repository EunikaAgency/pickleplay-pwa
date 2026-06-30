import { useEffect, useState } from 'react';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { Heatmap } from '../../../shared/components/ui/Chart';
import { Chip } from '../../../shared/components/ui/Chip';
import { OwnerStat } from '../components/OwnerStat';
import { OwnerSection } from '../components/OwnerSection';
import { PricingSuggestionsCard } from './PricingSuggestionsCard';
import { getVenueDemand, type VenueDemandReport } from '../../../shared/lib/api';

interface DemandTabProps {
  venueId: string;
  onOpenTab: (tab: string) => void;
}

const DAY_PRESETS = [30, 90, 365] as const;

const SIGNAL_LABELS: Record<string, string> = {
  search: 'Searches',
  venue_view: 'Views',
  booking_attempt: 'Attempts',
  booking_completed: 'Completed',
  booking_cancelled: 'Cancelled',
  empty_slot: 'Empty slots',
  checkout_started: 'Checkouts',
  checkout_abandoned: 'Abandoned',
  booking_link_shared: 'Links shared',
};

const SIGNAL_ICONS: Record<string, string> = {
  search: 'search',
  venue_view: 'visibility',
  booking_attempt: 'play_arrow',
  booking_completed: 'check_circle',
  booking_cancelled: 'cancel',
  empty_slot: 'block',
  checkout_started: 'shopping_cart',
  checkout_abandoned: 'undo',
  booking_link_shared: 'share',
};

const SIGNAL_ORDER = [
  'search', 'venue_view', 'booking_attempt', 'checkout_started',
  'checkout_abandoned', 'booking_completed', 'booking_cancelled',
  'empty_slot', 'booking_link_shared',
];

/** "72%" or "—" */
function pct(n: number | null): string {
  return n != null ? `${n}%` : '—';
}

export function DemandTab({ venueId, onOpenTab }: DemandTabProps) {
  const [data, setData] = useState<VenueDemandReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [days, setDays] = useState<number>(30);
  const [retryCtr, setRetryCtr] = useState(0);

  useEffect(() => {
    setStatus('loading');
    let alive = true;
    getVenueDemand(venueId, days)
      .then((r) => { if (alive) { setData(r); setStatus('ready'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [venueId, days, retryCtr]);

  if (status === 'loading') return <LoadingSkeleton variant="card" count={4} />;
  if (status === 'error') return <ErrorState message="Couldn't load the demand report." onRetry={() => setRetryCtr((k) => k + 1)} />;
  if (!data) return null;

  const { totals, conversionPct, cancelRate, liveBookings, demandByHour, supply } = data;

  // Heatmap: 1 row ("Demand") × 24 cols (hours 0–23).
  const heatmapCells = demandByHour.map((v, h) => ({ row: 0, col: h, value: v }));

  return (
    <div className="flex flex-col gap-5">
      {/* Day-range selector */}
      <div className="flex gap-2">
        {DAY_PRESETS.map((d) => (
          <Chip key={d} className="chip-tab" selected={days === d} onClick={() => setDays(d)}>
            {d}d
          </Chip>
        ))}
      </div>

      {/* Signal summary grid */}
      <OwnerSection title="Demand signals" icon="signal_cellular_alt" description={`Last ${days} days`}>
        <div className="grid grid-cols-3 gap-3">
          {SIGNAL_ORDER.map((key) => (
            <OwnerStat
              key={key}
              label={SIGNAL_LABELS[key] ?? key}
              value={String(totals[key] ?? 0)}
              icon={SIGNAL_ICONS[key] ?? 'bar_chart'}
            />
          ))}
        </div>
      </OwnerSection>

      {/* Conversion & cancellation */}
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Conversion" value={pct(conversionPct)} tone="lime" icon="trending_up" />
        <OwnerStat label="Cancellation rate" value={`${cancelRate}%`} tone="coral" icon="cancel" />
      </div>

      {/* Demand-by-hour heatmap */}
      <OwnerSection title="Demand by hour" icon="schedule" description="Booking attempts + empty-slot hits per hour">
        <Heatmap
          cells={heatmapCells}
          rows={1}
          cols={24}
          rowLabel={(r) => r === 0 ? 'Demand' : ''}
          colLabel={(c) => `${c}:00`}
          emptyLabel="No demand data yet"
        />
      </OwnerSection>

      {/* Supply summary */}
      <OwnerSection title="Supply" icon="paddle" description="Court-hour capacity vs utilisation">
        <div className="grid grid-cols-2 gap-3">
          <OwnerStat label="Open court‑hours" value={String(supply.openCourtHours)} icon="schedule" />
          <OwnerStat label="Booked court‑hours" value={String(supply.bookedCourtHours)} icon="check_circle" />
          <OwnerStat label="Empty court‑hours" value={String(supply.emptyCourtHours)} icon="block" />
          <OwnerStat label="Occupancy" value={`${supply.occupancyPct}%`} tone={supply.occupancyPct >= 50 ? 'lime' : 'coral'} icon="bar_chart" />
        </div>
        <p className="mt-2 text-[13px] text-[var(--ink-2)]">
          {liveBookings} live booking{liveBookings !== 1 ? 's' : ''} · {pct(conversionPct)} conversion · {cancelRate}% cancelled
        </p>
      </OwnerSection>

      {/* Quick link to the full leakage funnel */}
      <button
        type="button"
        onClick={() => onOpenTab('leakage')}
        className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 flex items-center justify-between"
      >
        <div>
          <div className="font-semibold text-[var(--ink)] text-[15px]">Booking funnel</div>
          <div className="text-[13px] text-[var(--ink-2)]">See where players drop off →</div>
        </div>
        <Chip>Leakage</Chip>
      </button>

      {/* Inline pricing suggestions (already built) */}
      <PricingSuggestionsCard venueId={venueId} />
    </div>
  );
}
