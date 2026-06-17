import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Segmented } from '../../shared/components/ui/Segmented';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { BarChart, Heatmap, ChartLegend } from '../../shared/components/ui/Chart';
import { OwnerStat } from './components/OwnerStat';
import { OwnerSection } from './components/OwnerSection';
import { useOwnerDashboard, venueKey } from './hooks/useOwnerDashboard';
import { bucketRevenue, pctChange, mergeBookingsDaily, mergePeakHours, mergeTopCustomers, type RevenueBucket } from './utils/ownerMetrics';
import { money } from '../bookings/bookingDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerInsightsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type Section = 'revenue' | 'bookings' | 'usage' | 'venues';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dowToRow = (d: number) => (d + 6) % 7;
const STATUS_COLORS = { confirmed: 'var(--lime)', paid: 'var(--primary)', pending: 'var(--coral)', cancelled: 'var(--surface-3)' };
const shortName = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);

// All-venues analytics: combined trends across every owned venue PLUS a
// per-venue comparison (revenue & occupancy) the single-venue Insights can't show.
export function OwnerInsightsScreen({ onBack }: OwnerInsightsScreenProps) {
  const { venues, status, retry, analyticsByVenue, combined } = useOwnerDashboard();
  const [section, setSection] = useState<Section>('revenue');
  const [revMode, setRevMode] = useState<RevenueBucket>('week');

  const list = useMemo(() => Object.values(analyticsByVenue), [analyticsByVenue]);

  const revToday = useMemo(() => list.reduce((t, a) => t + a.kpis.revenue.today, 0), [list]);
  const occAvg = useMemo(() => (list.length ? Math.round(list.reduce((t, a) => t + a.kpis.occupancyPct.week, 0) / list.length) : 0), [list]);
  const occPrev = useMemo(() => (list.length ? Math.round(list.reduce((t, a) => t + a.kpis.occupancyPct.prevWeek, 0) / list.length) : 0), [list]);

  const revenueDaily = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of list) for (const d of a.revenueDaily) map.set(d.date, (map.get(d.date) || 0) + d.amount);
    return [...map.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([date, amount]) => ({ date, amount }));
  }, [list]);
  const revenuePoints = useMemo(() => bucketRevenue(revenueDaily, revMode), [revenueDaily, revMode]);

  const bookingsDaily = useMemo(() => mergeBookingsDaily(list), [list]);
  const peakHours = useMemo(() => mergePeakHours(list), [list]);
  const topCustomers = useMemo(() => mergeTopCustomers(list), [list]);

  const byVenue = useMemo(() => {
    return venues
      .map((v) => ({ v, a: analyticsByVenue[venueKey(v)] }))
      .filter((x) => x.a)
      .map((x) => ({ name: x.v.displayName || 'Venue', month: x.a!.kpis.revenue.month, occ: x.a!.kpis.occupancyPct.week }))
      .sort((a, b) => b.month - a.month);
  }, [venues, analyticsByVenue]);

  const header = <ScreenHeader onBack={onBack} eyebrow="Owner console" title="Insights" subtitle="Across all your venues" />;

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={3} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<ErrorState title="Couldn't load insights" message="We couldn't reach the analytics service." onRetry={retry} /></div>;
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4 pb-4">
        {/* Combined KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <OwnerStat label="Revenue today" value={money(revToday)} icon="payments" tone="lime" />
          <OwnerStat label="Revenue this week" value={money(combined.week)} icon="payments" tone="primary" />
          <OwnerStat label="Revenue this month" value={money(combined.month)} icon="trending_up" tone="neutral" />
          <OwnerStat label="Avg occupancy (wk)" value={`${occAvg}%`} icon="donut_large" tone="coral" />
        </div>

        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: 'revenue', label: 'Revenue' },
            { value: 'bookings', label: 'Bookings' },
            { value: 'usage', label: 'Usage' },
            { value: 'venues', label: 'Venues' },
          ]}
        />

        {section === 'revenue' && (
          <OwnerSection title="Revenue trend" icon="trending_up" description="All venues combined">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className={`text-[12px] font-bold truncate min-w-0 ${combined.month >= combined.prevMonth ? 'text-[var(--lime-ink)]' : 'text-[var(--coral)]'}`}>
                {pctChange(combined.month, combined.prevMonth) >= 0 ? '+' : ''}{pctChange(combined.month, combined.prevMonth)}% vs last month
              </span>
              <Segmented
                className="shrink-0 min-w-[210px]"
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
        )}

        {section === 'bookings' && (
          <OwnerSection title="Bookings volume" icon="bar_chart" description="By status, all venues">
            <BarChart
              height={150}
              data={bookingsDaily.map((d) => ({
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
        )}

        {section === 'usage' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <OwnerStat label="Avg occupancy this week" value={`${occAvg}%`} icon="donut_large" tone="primary" />
              <OwnerStat label="Last week" value={`${occPrev}%`} icon="donut_large" tone="neutral" />
            </div>
            <OwnerSection title="Peak hours" icon="schedule" description="Busiest days & times across venues">
              <Heatmap
                rows={7}
                cols={24}
                cells={peakHours.map((p) => ({ row: dowToRow(p.dayOfWeek), col: p.hour, value: p.bookings }))}
                rowLabel={(r) => DOW[r]}
                colLabel={(c) => (c % 6 === 0 ? `${c}h` : '')}
                emptyLabel="Not enough bookings to map peak hours yet"
              />
            </OwnerSection>
          </>
        )}

        {section === 'venues' && (
          <>
            <OwnerSection title="Revenue by venue" icon="storefront" description="This month">
              {byVenue.length === 0 ? (
                <div className="t-sm py-2">No revenue yet.</div>
              ) : (
                <BarChart
                  data={byVenue.map((x) => ({ label: shortName(x.name), segments: [{ value: x.month, color: 'var(--primary)' }] }))}
                  formatValue={(n) => money(n)}
                  maxLabels={byVenue.length}
                />
              )}
            </OwnerSection>
            <OwnerSection title="Occupancy by venue" icon="donut_large" description="This week">
              <div className="space-y-2.5">
                {byVenue.map((x) => (
                  <div key={x.name}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-[var(--ink)] font-semibold truncate pr-2">{x.name}</span>
                      <span className="text-[var(--muted)] tabular-nums shrink-0">{x.occ}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${x.occ}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </OwnerSection>
            <OwnerSection title="Top customers" icon="groups" description="By spend, all venues">
              {topCustomers.length === 0 ? (
                <div className="t-sm py-2">No customers yet.</div>
              ) : (
                <div className="space-y-2">
                  {topCustomers.map((c) => (
                    <div key={c.userId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{c.name}</div>
                        <div className="t-sm">{c.bookings} booking{c.bookings === 1 ? '' : 's'}</div>
                      </div>
                      <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums shrink-0">{money(c.spend)}</div>
                    </div>
                  ))}
                </div>
              )}
            </OwnerSection>
          </>
        )}
      </div>
    </div>
  );
}
