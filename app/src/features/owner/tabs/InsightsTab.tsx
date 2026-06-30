import { useEffect, useMemo, useState } from 'react';
import { Segmented } from '../../../shared/components/ui/Segmented';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { BarChart, Heatmap, ChartLegend } from '../../../shared/components/ui/Chart';
import { OwnerStat } from '../components/OwnerStat';
import { OwnerSection } from '../components/OwnerSection';
import { bucketRevenue, pctChange, type RevenueBucket } from '../utils/ownerMetrics';
import { getVenueAnalytics, listGames, type OwnerAnalytics, type ApiGame } from '../../../shared/lib/api';
import { money } from '../../bookings/bookingDisplay';
import { DemandTab } from './DemandTab';
import { LeakageTab } from './LeakageTab';

interface InsightsTabProps {
  venueId: string;
}

type Section = 'revenue' | 'bookings' | 'utilization' | 'courts' | 'demand' | 'leakage';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Server uses JS getDay() (0=Sun..6=Sat); map to a Mon-first row index.
const dowToRow = (d: number) => (d + 6) % 7;

const STATUS_COLORS = {
  confirmed: 'var(--lime)',
  paid: 'var(--primary)',
  pending: 'var(--coral)',
  cancelled: 'var(--surface-3)',
};

function ChangeBadge({ pct }: { pct: number }) {
  return (
    <span className={`text-[12px] font-bold ${pct >= 0 ? 'text-[var(--lime-ink)]' : 'text-[var(--coral)]'}`}>
      {pct >= 0 ? '+' : ''}{pct}% vs last
    </span>
  );
}

// Detailed analytics, grouped into one section at a time so the screen never
// feels crowded. All metrics come from getVenueAnalytics (server-aggregated).
export function InsightsTab({ venueId }: InsightsTabProps) {
  const [data, setData] = useState<OwnerAnalytics | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [section, setSection] = useState<Section>('revenue');
  const [revMode, setRevMode] = useState<RevenueBucket>('week');

  const load = () => {
    setStatus('loading');
    Promise.allSettled([getVenueAnalytics(venueId), listGames({ venueId })]).then(([a, g]) => {
      if (a.status === 'fulfilled') { setData(a.value); setStatus('ready'); } else { setStatus('error'); }
      if (g.status === 'fulfilled') setGames(g.value);
    });
  };
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getVenueAnalytics(venueId), listGames({ venueId })]).then(([a, g]) => {
      if (cancelled) return;
      if (a.status === 'fulfilled') { setData(a.value); setStatus('ready'); } else { setStatus('error'); }
      if (g.status === 'fulfilled') setGames(g.value);
    });
    return () => { cancelled = true; };
  }, [venueId]);

  const revenuePoints = useMemo(
    () => (data ? bucketRevenue(data.revenueDaily, revMode) : []),
    [data, revMode],
  );

  if (status === 'loading') return <LoadingSkeleton variant="card" count={3} />;
  if (status === 'error' || !data) return <ErrorState title="Couldn't load analytics" message="We couldn't reach the analytics service." onRetry={load} />;

  const { kpis } = data;

  return (
    <div className="space-y-4">
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'revenue', label: 'Revenue' },
          { value: 'bookings', label: 'Bookings' },
          { value: 'utilization', label: 'Usage' },
          { value: 'courts', label: 'Courts' },
          { value: 'demand', label: 'Demand' },
          { value: 'leakage', label: 'Leakage' },
        ]}
      />

      {/* ── Revenue ── */}
      {section === 'revenue' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <OwnerStat label="Today" value={money(kpis.revenue.today)} icon="payments" tone="lime" />
            <OwnerStat label="This week" value={money(kpis.revenue.week)} icon="payments" tone="primary" />
            <OwnerStat label="This month" value={money(kpis.revenue.month)} icon="payments" tone="neutral" />
          </div>
          <OwnerSection title="Revenue trend" icon="trending_up" description="Earned from confirmed & paid bookings">
            <div className="flex items-center justify-between mb-3">
              <ChangeBadge pct={kpis.revenue.momChangePct} />
              <Segmented
                className="shrink-0"
                value={revMode}
                onChange={setRevMode}
                options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
              />
            </div>
            <BarChart
              data={revenuePoints.map((p) => ({ label: p.label, segments: [{ value: p.amount, color: 'var(--primary)' }] }))}
              formatValue={(n) => money(n)}
              emptyLabel="No revenue in this period yet"
            />
          </OwnerSection>
        </>
      )}

      {/* ── Bookings ── */}
      {section === 'bookings' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <OwnerStat label="This week" value={kpis.bookings.week} icon="calendar" tone="primary" />
            <OwnerStat label="Pending" value={kpis.bookings.pending} icon="bell" tone="coral" />
            <OwnerStat label="Upcoming" value={kpis.bookings.upcoming} icon="event_upcoming" tone="lime" />
          </div>
          <OwnerSection title="Bookings volume" icon="bar_chart" description="By status, per day">
            <BarChart
              height={150}
              data={data.bookingsDaily.map((d) => ({
                label: d.date.slice(5).replace('-', '/'),
                segments: [
                  { value: d.paid, color: STATUS_COLORS.paid },
                  { value: d.confirmed, color: STATUS_COLORS.confirmed },
                  { value: d.pending, color: STATUS_COLORS.pending },
                  { value: d.cancelled, color: STATUS_COLORS.cancelled },
                ],
              }))}
              emptyLabel="No bookings in this window yet"
            />
            <ChartLegend items={[
              { label: 'Paid', color: STATUS_COLORS.paid },
              { label: 'Confirmed', color: STATUS_COLORS.confirmed },
              { label: 'Pending', color: STATUS_COLORS.pending },
              { label: 'Cancelled', color: STATUS_COLORS.cancelled },
            ]} />
          </OwnerSection>
        </>
      )}

      {/* ── Utilization ── */}
      {section === 'utilization' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <OwnerStat label="Occupancy this week" value={`${kpis.occupancyPct.week}%`} icon="donut_large" tone="primary" />
            <OwnerStat label="Last week" value={`${kpis.occupancyPct.prevWeek}%`} icon="donut_large" tone="neutral" />
          </div>
          <OwnerSection title="Occupancy change" icon="trending_up">
            <ChangeBadge pct={pctChange(kpis.occupancyPct.week, kpis.occupancyPct.prevWeek)} />
            <div className="mt-1 t-sm">Share of bookable court-hours that were booked.</div>
          </OwnerSection>
          <OwnerSection title="Peak hours" icon="schedule" description="Busiest days & times — guide your pricing">
            <Heatmap
              rows={7}
              cols={24}
              cells={data.peakHours.map((p) => ({ row: dowToRow(p.dayOfWeek), col: p.hour, value: p.bookings }))}
              rowLabel={(r) => DOW[r]}
              colLabel={(c) => (c % 6 === 0 ? `${c}h` : '')}
              emptyLabel="Not enough bookings to map peak hours yet"
            />
          </OwnerSection>
        </>
      )}

      {/* ── Courts & customers ── */}
      {section === 'courts' && (
        <>
          <OwnerSection title="Revenue by court" icon="paddle">
            {data.byCourt.length === 0 ? (
              <div className="t-sm py-2">No court-attributed revenue yet.</div>
            ) : (
              <BarChart
                data={data.byCourt.map((c) => ({ label: `#${c.courtNumber}`, segments: [{ value: c.amount, color: 'var(--primary)' }] }))}
                formatValue={(n) => money(n)}
                maxLabels={12}
              />
            )}
          </OwnerSection>
          <OwnerSection title="Top customers" icon="groups" description="By spend">
            {data.topCustomers.length === 0 ? (
              <div className="t-sm py-2">No customers yet.</div>
            ) : (
              <div className="space-y-2">
                {data.topCustomers.map((cst) => (
                  <div key={cst.userId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{cst.name}</div>
                      <div className="t-sm">{cst.bookings} booking{cst.bookings === 1 ? '' : 's'}</div>
                    </div>
                    <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums shrink-0">{money(cst.spend)}</div>
                  </div>
                ))}
              </div>
            )}
          </OwnerSection>
          <OwnerSection title="Games at your venue" icon="bolt" description="Player-organized games drive foot traffic">
            {games.length === 0 ? (
              <div className="t-sm py-2">No games scheduled here yet.</div>
            ) : (
              <div className="space-y-1.5">
                <div className="font-heading font-semibold text-[18px] text-[var(--ink)]">{games.length} game{games.length === 1 ? '' : 's'}</div>
                {games.slice(0, 5).map((g) => (
                  <div key={g.id} className="t-sm truncate">• {g.title || 'Pickleball game'}{g.timeLabel ? ` — ${g.timeLabel}` : ''}</div>
                ))}
              </div>
            )}
          </OwnerSection>
        </>
      )}

      {/* ── Demand (player behaviour signals) ── */}
      {section === 'demand' && <DemandTab venueId={venueId} onOpenTab={() => {}} />}

      {/* ── Leakage (online vs offline bookings funnel) ── */}
      {section === 'leakage' && <LeakageTab venueId={venueId} />}
    </div>
  );
}
