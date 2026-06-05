import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Segmented } from '../../../shared/components/ui/Segmented';
import { BarChart, Sparkline } from '../../../shared/components/ui/Chart';
import { OwnerStat } from '../components/OwnerStat';
import { CompletenessMeter, type CompletenessCheck } from '../components/CompletenessMeter';
import { bucketRevenue, upcomingPreview, pctChange, type RevenueBucket } from '../utils/ownerMetrics';
import {
  getVenueAnalytics, getVenueBookings, listCourts, getHours, listFaqs, getReviews,
  type OwnerVenueDetail, type OwnerAnalytics, type ApiBooking,
} from '../../../shared/lib/api';
import { money, prettyDate, to12h, statusChip } from '../../bookings/bookingDisplay';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';

interface VenueOverviewTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  onOpenTab: (tab: string) => void;
}

interface Counts {
  courts: number | null;
  hoursDays: number | null;
  faqs: number | null;
}

const EDITOR_ACTIONS = [
  { tab: 'listing', icon: 'storefront', label: 'Edit listing details' },
  { tab: 'hours', icon: 'clock', label: 'Set hours & closures' },
  { tab: 'courts', icon: 'paddle', label: 'Manage courts' },
  { tab: 'faqs', icon: 'help', label: 'Edit FAQs' },
  { tab: 'photos', icon: 'camera', label: 'Manage photos' },
];

// KPIs-first owner dashboard: revenue + bookings + occupancy lead, with a
// headline revenue trend chart and drill-downs into the Insights tab. Listing
// setup (completeness + editor links) is demoted to the bottom.
export function VenueOverviewTab({ venue, venueId, onOpenTab }: VenueOverviewTabProps) {
  const user = useAuthStore((s) => s.user);
  const canAnalytics = userHasPermission(user, 'owner.analytics.view');
  const canBookings = userHasPermission(user, 'owner.bookings.manage');

  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [reviews, setReviews] = useState<{ rating: number | null; count: number }>({ rating: null, count: 0 });
  const [counts, setCounts] = useState<Counts>({ courts: null, hoursDays: null, faqs: null });
  const [revMode, setRevMode] = useState<RevenueBucket>('day');

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    Promise.allSettled([
      canAnalytics ? getVenueAnalytics(venueId) : Promise.reject(),
      canBookings ? getVenueBookings(venueId) : Promise.reject(),
      getReviews(venueId),
      listCourts(venueId),
      getHours(venueId),
      listFaqs(venueId),
    ]).then(([a, b, r, courts, hours, faqs]) => {
      if (cancelled) return;
      if (a.status === 'fulfilled') setAnalytics(a.value);
      if (b.status === 'fulfilled') setBookings(b.value);
      if (r.status === 'fulfilled') setReviews({ rating: r.value.rating, count: r.value.count });
      setCounts({
        courts: courts.status === 'fulfilled' ? courts.value.length : 0,
        hoursDays: hours.status === 'fulfilled' ? hours.value.filter((h) => !h.isClosed && h.openTime).length : 0,
        faqs: faqs.status === 'fulfilled' ? faqs.value.length : 0,
      });
    });
    return () => { cancelled = true; };
  }, [venueId, canAnalytics, canBookings]);

  const revenuePoints = useMemo(
    () => (analytics ? bucketRevenue(analytics.revenueDaily, revMode) : []),
    [analytics, revMode],
  );
  const revTotal = revenuePoints.reduce((t, p) => t + p.amount, 0);
  const periodChange = revenuePoints.length >= 2
    ? pctChange(revenuePoints[revenuePoints.length - 1].amount, revenuePoints[revenuePoints.length - 2].amount)
    : 0;
  const upcoming = useMemo(() => upcomingPreview(bookings, 4), [bookings]);

  const kpis = analytics?.kpis;
  const extra: CompletenessCheck[] = [
    { label: 'At least one court', done: (counts.courts ?? 0) > 0 },
    { label: 'Operating hours set', done: (counts.hoursDays ?? 0) > 0 },
    { label: 'At least one FAQ', done: (counts.faqs ?? 0) > 0 },
  ];

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Revenue this month" value={money(kpis?.revenue.month ?? 0)} icon="payments" tone="primary" />
        <OwnerStat label="Today's bookings" value={kpis?.bookings.today ?? 0} icon="calendar" tone="lime" />
        {canBookings && (kpis?.bookings.pending ?? 0) > 0 ? (
          <button type="button" className="text-left" onClick={() => onOpenTab('bookings')}>
            <OwnerStat label="Awaiting approval" value={kpis?.bookings.pending ?? 0} icon="bell" tone="coral" />
          </button>
        ) : (
          <OwnerStat label="Upcoming" value={kpis?.bookings.upcoming ?? 0} icon="event_upcoming" tone="neutral" />
        )}
        <OwnerStat label="Occupancy (wk)" value={`${kpis?.occupancyPct.week ?? 0}%`} icon="donut_large" tone="neutral" />
      </div>

      {!canAnalytics && (
        <div className="card p-4 t-sm">
          You don't have the venue-analytics permission yet, so revenue and occupancy show as zero. Ask an admin to enable
          {' '}<span className="font-semibold">View venue analytics</span> for your role.
        </div>
      )}

      {/* Headline revenue trend */}
      {canAnalytics && (
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="hd-3">Revenue</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-heading font-semibold text-[20px] text-[var(--ink)] tabular-nums">{money(revTotal)}</span>
                {revenuePoints.length >= 2 && (
                  <span className={`text-[12px] font-bold inline-flex items-center gap-0.5 ${periodChange >= 0 ? 'text-[var(--lime-ink)]' : 'text-[var(--coral)]'}`}>
                    <Icon name={periodChange >= 0 ? 'trending_up' : 'trending_down'} size={13} />
                    {periodChange >= 0 ? '+' : ''}{periodChange}%
                  </span>
                )}
              </div>
            </div>
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
        </section>
      )}

      {/* Drill-down into detailed analytics */}
      {canAnalytics && (
        <div>
          <div className="t-eyebrow mb-2">Insights</div>
          <div className="set-list">
            {[
              { icon: 'calendar', label: 'Bookings & demand', sub: `${kpis?.bookings.week ?? 0} this week` },
              { icon: 'donut_large', label: 'Utilization & peak hours', sub: `${kpis?.occupancyPct.week ?? 0}% occupancy` },
              { icon: 'leaderboard', label: 'Courts & customers', sub: `${analytics?.byCourt.length ?? 0} courts earning` },
            ].map((d) => (
              <button key={d.label} type="button" className="row" onClick={() => onOpenTab('insights')}>
                <div className="ic bg-[var(--primary)]"><Icon name={d.icon} size={16} /></div>
                <div className="body">
                  <div className="name">{d.label}</div>
                  <div className="t-sm">{d.sub}</div>
                </div>
                <Icon name="chevron" size={16} className="chev" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming bookings */}
      {canBookings && (
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="hd-3">Upcoming bookings</div>
            <button type="button" className="text-[13px] font-bold text-[var(--primary)]" onClick={() => onOpenTab('bookings')}>View all</button>
          </div>
          {upcoming.length === 0 ? (
            <div className="t-sm py-2">No upcoming bookings.</div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((b) => {
                const chip = statusChip(b.status);
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{b.userName || 'Player'}</div>
                      <div className="t-sm truncate">{prettyDate(b.date)}{b.startTime ? ` · ${to12h(b.startTime)}` : ''}{b.playerCount ? ` · ${b.playerCount}p` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums">{money(b.amount)}</div>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.className}`}>{chip.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Reviews alert */}
      {reviews.count > 0 && (
        reviews.rating != null && reviews.rating < 4 ? (
          <button type="button" className="card p-4 w-full text-left flex items-center gap-3" onClick={() => onOpenTab('reviews')}>
            <div className="w-9 h-9 rounded-[10px] bg-[var(--coral-soft)] text-[var(--coral)] flex items-center justify-center shrink-0"><Icon name="star" size={18} /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[14px] text-[var(--ink)]">Rating needs attention — {reviews.rating.toFixed(1)}★</div>
              <div className="t-sm">{reviews.count} review{reviews.count === 1 ? '' : 's'} · reply to win players back</div>
            </div>
            <Icon name="chevron" size={16} className="text-[var(--muted)]" />
          </button>
        ) : (
          <button type="button" className="card p-4 w-full text-left flex items-center gap-3" onClick={() => onOpenTab('reviews')}>
            <div className="w-9 h-9 rounded-[10px] bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center shrink-0"><Icon name="star" size={18} /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[14px] text-[var(--ink)]">{reviews.rating != null ? `${reviews.rating.toFixed(1)}★ average` : 'Reviews'}</div>
              <div className="t-sm">{reviews.count} review{reviews.count === 1 ? '' : 's'}</div>
            </div>
            <Icon name="chevron" size={16} className="text-[var(--muted)]" />
          </button>
        )
      )}

      {/* Setup (demoted) */}
      <div>
        <div className="t-eyebrow mb-2">Setup</div>
        <div className="space-y-3">
          <CompletenessMeter venue={venue} extra={extra} />
          <div className="set-list">
            {EDITOR_ACTIONS.map((a) => (
              <button key={a.tab} type="button" className="row" onClick={() => onOpenTab(a.tab)}>
                <div className="ic bg-[var(--surface-3)] text-[var(--ink-2)]"><Icon name={a.icon} size={16} /></div>
                <div className="body"><div className="name">{a.label}</div></div>
                <Icon name="chevron" size={16} className="chev" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sparkline footer hint of overall trend (subtle) */}
      {canAnalytics && analytics && analytics.revenueDaily.length > 1 && (
        <div className="px-1">
          <div className="t-eyebrow mb-1">Last {analytics.revenueDaily.length} days</div>
          <Sparkline points={analytics.revenueDaily.map((d) => d.amount)} />
        </div>
      )}
    </div>
  );
}
