import { useEffect, useState } from 'react';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { BarChart } from '../../../shared/components/ui/Chart';
import { OwnerStat } from '../components/OwnerStat';
import { OwnerSection } from '../components/OwnerSection';
import { getVenueLeakageReport, type VenueLeakageReport } from '../../../shared/lib/api';
import type { BarDatum } from '../../../shared/components/ui/Chart';

interface LeakageTabProps {
  venueId: string;
}

const DAY_PRESETS = [7, 30, 90] as const;

/** "72%" or "—" */
function pct(n: number | null): string {
  return n != null ? `${n}%` : '—';
}

export function LeakageTab({ venueId }: LeakageTabProps) {
  const [data, setData] = useState<VenueLeakageReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [days, setDays] = useState<number>(30);

  const load = (d: number) => {
    setStatus('loading');
    setDays(d);
    getVenueLeakageReport(venueId, d)
      .then((r) => { setData(r); setStatus('ready'); })
      .catch(() => setStatus('error'));
  };

  useEffect(() => { load(days); }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <LoadingSkeleton variant="card" count={3} />;
  if (status === 'error') return <ErrorState message="Couldn't load the leakage report." onRetry={() => load(days)} />;
  if (!data) return null;

  const { funnel, leakageRate, checkoutDropoff, daily } = data;

  // Funnel bar chart: each stage as a single-segment bar.
  const funnelData: BarDatum[] = [
    { label: 'Views', segments: [{ value: funnel.views, color: 'var(--primary)' }] },
    { label: 'Starts', segments: [{ value: funnel.bookingStarts, color: 'var(--lime)' }] },
    { label: 'Checkouts', segments: [{ value: funnel.checkoutStarts, color: 'var(--coral)' }] },
    { label: 'Online', segments: [{ value: funnel.onlineBookings, color: 'var(--lime-ink)' }] },
  ];

  // Daily stacked bar: 4 segments per day.
  const dailyData: BarDatum[] = daily.map((d) => ({
    label: d.date.slice(5), // MM-DD
    segments: [
      { value: d.online, color: 'var(--primary)' },
      { value: Math.max(0, d.checkouts - d.online), color: 'var(--coral)' },
      { value: Math.max(0, d.starts - d.checkouts), color: 'var(--lime)' },
      { value: Math.max(0, d.views - d.starts - d.checkouts), color: 'var(--surface-3)' },
    ],
  }));

  const manualLabel = funnel.manualBookings > 0 ? `${funnel.manualBookings} manual` : 'None';

  return (
    <div className="flex flex-col gap-4">
      {/* Day-range picker */}
      <div className="flex gap-2">
        {DAY_PRESETS.map((d) => (
          <button
            key={d}
            className={`chip ${days === d ? 'active' : ''}`}
            onClick={() => load(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Page views" icon="visibility" value={funnel.views} />
        <OwnerStat label="Booking starts" icon="play_arrow" value={funnel.bookingStarts} />
        <OwnerStat label="Online bookings" icon="check_circle" value={funnel.onlineBookings} />
        <OwnerStat label="Manual (offline)" icon="storefront" value={manualLabel} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Leakage rate" icon="leak" value={pct(leakageRate)} />
        <OwnerStat label="Checkout drop-off" icon="shopping_cart" value={pct(checkoutDropoff)} />
      </div>

      {funnel.linksShared > 0 && (
        <OwnerStat label="Booking link shares" icon="share" value={funnel.linksShared} />
      )}

      {/* Funnel bar chart */}
      <OwnerSection title="Booking funnel" icon="bar_chart">
        <BarChart data={funnelData} height={160} />
      </OwnerSection>

      {/* Daily timeseries */}
      <OwnerSection title="Daily breakdown" icon="calendar">
        {dailyData.length === 0 ? (
          <EmptyState icon="insights" title="No data yet" description="Activity will appear here as players interact with your venue." />
        ) : (
          <div className="overflow-x-auto">
            <BarChart data={dailyData} height={200} />
            <div className="flex flex-col gap-1 mt-3 max-h-[300px] overflow-y-auto">
              {[...daily].reverse().map((d) => (
                <div key={d.date} className="flex items-center gap-3 text-[13px] py-1 border-b border-[var(--hairline)] last:border-0">
                  <span className="font-bold w-[60px] shrink-0">{d.date.slice(5)}</span>
                  <span className="w-[60px] text-right shrink-0">{d.views} views</span>
                  <span className="w-[40px] text-right shrink-0 text-[var(--lime-ink)]">{d.starts}</span>
                  <span className="w-[40px] text-right shrink-0 text-[var(--coral)]">{d.checkouts}</span>
                  <span className="w-[40px] text-right shrink-0 font-bold text-[var(--primary)]">{d.online}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </OwnerSection>
    </div>
  );
}
