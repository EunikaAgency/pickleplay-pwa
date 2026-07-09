import { useMemo, useState, type ReactNode } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Icon } from '../../shared/components/ui/Icon';
import { Dropdown } from '../../shared/components/ui/Dropdown';
import { Segmented } from '../../shared/components/ui/Segmented';
import { Toast } from '../../shared/components/ui/Toast';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { BarChart, LineChart, DonutChart } from '../../shared/components/ui/Chart';
import { KpiCard } from './components/KpiCard';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { useOwnerDashboard, venueKey } from './hooks/useOwnerDashboard';
import { pctChange } from './utils/ownerMetrics';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { money, prettyDate, to12h, todayYMD } from '../bookings/bookingDisplay';
import type { ApiBooking, ApiVenue } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

type StatusFilter = 'all' | 'pending_approval' | 'awaiting_payment' | 'confirmed' | 'cancelled';
type RangeId = 'week' | 'month' | 'quarter' | 'year' | 'all';
type Gran = 'day' | 'week' | 'month' | 'year';

interface OwnerBookingsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** Pre-select a status filter when deep-linked (e.g. from the home "Awaiting approval" card). */
  initialStatus?: 'all' | 'pending_approval' | 'confirmed' | 'cancelled';
}

const RANGE_OPTIONS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'total', label: 'Bookings' },
  { value: 'occ', label: 'Occupancy' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'score', label: 'Score' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = (s: string) => new Date(`${s}T00:00:00`);
const shortName = (s: string) => (s.length > 13 ? `${s.slice(0, 12)}…` : s);

/* ── Analytics window (calendar period containing today) ─────────────── */

interface Bounds { start: string; end: string; prevStart: string | null; prevEnd: string | null }

function windowBounds(id: RangeId): Bounds {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (id === 'all') return { start: '0000-01-01', end: '9999-12-31', prevStart: null, prevEnd: null };
  if (id === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const pMon = new Date(mon); pMon.setDate(mon.getDate() - 7);
    const pSun = new Date(mon); pSun.setDate(mon.getDate() - 1);
    return { start: toYMD(mon), end: toYMD(sun), prevStart: toYMD(pMon), prevEnd: toYMD(pSun) };
  }
  if (id === 'month') {
    return {
      start: toYMD(new Date(y, m, 1)), end: toYMD(new Date(y, m + 1, 0)),
      prevStart: toYMD(new Date(y, m - 1, 1)), prevEnd: toYMD(new Date(y, m, 0)),
    };
  }
  if (id === 'quarter') {
    const q = Math.floor(m / 3);
    return {
      start: toYMD(new Date(y, q * 3, 1)), end: toYMD(new Date(y, q * 3 + 3, 0)),
      prevStart: toYMD(new Date(y, q * 3 - 3, 1)), prevEnd: toYMD(new Date(y, q * 3, 0)),
    };
  }
  // year
  return {
    start: toYMD(new Date(y, 0, 1)), end: toYMD(new Date(y, 11, 31)),
    prevStart: toYMD(new Date(y - 1, 0, 1)), prevEnd: toYMD(new Date(y - 1, 11, 31)),
  };
}

/* ── Booking classification ──────────────────────────────────────────── */

const isBlocked = (b: ApiBooking) => b.bookingType === 'blocked';
const isCancelled = (b: ApiBooking) => b.status === 'cancelled';
const isPaid = (b: ApiBooking) => b.status === 'confirmed' || b.status === 'paid';
const isPending = (b: ApiBooking) => b.status === 'pending_approval' || b.status === 'awaiting_payment';
const startTs = (b: ApiBooking) => (b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN);

// "HH:MM" → minutes since midnight (null if unparseable).
function toMin(t?: string | null): number | null {
  if (!t) return null;
  const mm = /^(\d{1,2}):(\d{2})/.exec(t);
  return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null;
}

// Creation date from a Mongo ObjectId's leading timestamp (seeded rows'
// createdAt is unreliable) → epoch ms, used for "recently booked" + activity.
function bookedTs(b: ApiBooking): number {
  if (b.createdAt) { const t = Date.parse(b.createdAt); if (!Number.isNaN(t)) return t; }
  const id = b.id || '';
  if (id.length >= 8) { const secs = parseInt(id.slice(0, 8), 16); if (!Number.isNaN(secs)) return secs * 1000; }
  return 0;
}
function relTime(ts: number, now: number): string {
  if (!ts) return '';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const mns = Math.round(s / 60); if (mns < 60) return `${mns}m ago`;
  const h = Math.round(mns / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d ago`;
  const dt = new Date(ts);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

/* ── Booking-count trend series (independent of the window; own lookback) ─ */

function bookingTrend(list: ApiBooking[], gran: Gran): { label: string; value: number }[] {
  const rows = list.filter((b) => !isBlocked(b) && b.date);
  const count = new Map<string, number>();
  const bump = (k: string) => count.set(k, (count.get(k) || 0) + 1);
  const now = new Date();

  if (gran === 'day') {
    for (const b of rows) bump(b.date as string);
    const out: { label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const k = toYMD(d);
      out.push({ label: i % 5 === 0 ? String(d.getDate()) : '', value: count.get(k) || 0 });
    }
    return out;
  }
  if (gran === 'week') {
    for (const b of rows) {
      const d = fromYMD(b.date as string);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      bump(toYMD(d));
    }
    const out: { label: string; value: number }[] = [];
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(mon); d.setDate(mon.getDate() - i * 7);
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: count.get(toYMD(d)) || 0 });
    }
    return out;
  }
  if (gran === 'month') {
    for (const b of rows) { const d = fromYMD(b.date as string); bump(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    const out: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: MONTHS[d.getMonth()], value: count.get(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`) || 0 });
    }
    return out;
  }
  // year
  for (const b of rows) bump(String(fromYMD(b.date as string).getFullYear()));
  const years = [...count.keys()].map(Number);
  const minY = years.length ? Math.min(...years) : now.getFullYear();
  const out: { label: string; value: number }[] = [];
  for (let yr = minY; yr <= now.getFullYear(); yr++) out.push({ label: String(yr), value: count.get(String(yr)) || 0 });
  return out.length ? out : [{ label: String(now.getFullYear()), value: 0 }];
}

/* ── Presentational helpers ──────────────────────────────────────────── */

function Panel({ title, icon, right, children, className = '' }: {
  title: string; icon: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Icon name={icon} size={16} />
          </span>
          <div className="hd-3 truncate">{title}</div>
        </div>
        {right && <div className="shrink-0 max-w-full grow sm:grow-0">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function scoreTone(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: '#16a34a', text: '#16794c' };
  if (score >= 60) return { bar: 'var(--star)', text: 'var(--star-ink)' };
  return { bar: 'var(--coral)', text: 'var(--coral)' };
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function OwnerBookingsScreen({ onBack, initialStatus = 'all' }: OwnerBookingsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry, bookings, analyticsByVenue, updateBookingRow } = useOwnerDashboard({ withBookings: true });

  // Master (dashboard) filters.
  const [range, setRange] = useState<RangeId>('year');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  // Chart / table local controls.
  const [gran, setGran] = useState<Gran>('month');
  const [tableSort, setTableSort] = useState<{ key: 'name' | 'total' | 'revenue' | 'occ' | 'cancelled' | 'score'; dir: 'asc' | 'desc' }>({ key: 'revenue', dir: 'desc' });
  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const [detail, setDetail] = useState<ApiBooking | null>(null);
  const [toast, setToast] = useState(false);

  const today = todayYMD();
  const [nowTs] = useState(() => Date.now());
  const bounds = useMemo(() => windowBounds(range), [range]);

  const venueOptions = useMemo(
    () => [{ value: 'all', label: 'All venues' }, ...venues.map((v) => ({ value: v.id, label: v.displayName || 'Venue' }))],
    [venues],
  );

  // Venue-scoped (respects the venue picker only) — the base for everything.
  const venueScoped = useMemo(
    () => bookings.filter((b) => venueFilter === 'all' || (b.venueId || '') === venueFilter),
    [bookings, venueFilter],
  );
  // Window-scoped (venue + date range) — drives the KPIs, charts, and table.
  const windowScoped = useMemo(
    () => venueScoped.filter((b) => !isBlocked(b) && !!b.date && b.date >= bounds.start && b.date <= bounds.end),
    [venueScoped, bounds],
  );
  const prevScoped = useMemo(
    () => venueScoped.filter((b) => !isBlocked(b) && bounds.prevStart != null && bounds.prevEnd != null && !!b.date && b.date >= bounds.prevStart && b.date <= bounds.prevEnd),
    [venueScoped, bounds],
  );

  /* KPIs */
  const kpis = useMemo(() => {
    const count = (list: ApiBooking[], f: (b: ApiBooking) => boolean) => list.filter(f).length;
    const revenue = (list: ApiBooking[]) => list.filter(isPaid).reduce((t, b) => t + (b.amount || 0), 0);

    const total = windowScoped.length;
    const upcoming = count(windowScoped, (b) => !isCancelled(b) && (Number.isNaN(startTs(b)) || startTs(b) >= nowTs));
    const completed = count(windowScoped, (b) => isPaid(b) && startTs(b) < nowTs);
    const cancelled = count(windowScoped, isCancelled);
    const rev = revenue(windowScoped);
    const paidCount = count(windowScoped, isPaid);
    const avgValue = paidCount ? Math.round(rev / paidCount) : 0;
    const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;

    const pTotal = prevScoped.length;
    const pRev = revenue(prevScoped);
    const pPaid = count(prevScoped, isPaid);
    const pCancelled = count(prevScoped, isCancelled);

    // Occupancy from server analytics (this week) — averaged, or the picked venue.
    const analyticsList = venueFilter === 'all'
      ? Object.values(analyticsByVenue)
      : venues.filter((v) => v.id === venueFilter).map((v) => analyticsByVenue[venueKey(v)]).filter(Boolean);
    const occ = analyticsList.length ? Math.round(analyticsList.reduce((t, a) => t + a.kpis.occupancyPct.week, 0) / analyticsList.length) : 0;
    const occPrev = analyticsList.length ? Math.round(analyticsList.reduce((t, a) => t + a.kpis.occupancyPct.prevWeek, 0) / analyticsList.length) : 0;

    return {
      total, upcoming, completed, cancelled, rev, avgValue, occ, cancelRate,
      totalDelta: pctChange(total, pTotal),
      completedDelta: pctChange(completed, count(prevScoped, (b) => isPaid(b) && startTs(b) < nowTs)),
      cancelledDelta: pctChange(cancelled, pCancelled),
      revDelta: pctChange(rev, pRev),
      avgDelta: pctChange(avgValue, pPaid ? Math.round(pRev / pPaid) : 0),
      occDelta: pctChange(occ, occPrev),
      cancelRateDelta: pctChange(cancelRate, pTotal ? Math.round((pCancelled / pTotal) * 100) : 0),
    };
  }, [windowScoped, prevScoped, analyticsByVenue, venues, venueFilter, nowTs]);

  const hasPrev = range !== 'all';
  const rangeWord = range === 'week' ? 'week' : range === 'month' ? 'month' : range === 'quarter' ? 'quarter' : 'year';

  /* Trend line */
  const trend = useMemo(() => bookingTrend(venueScoped, gran), [venueScoped, gran]);

  /* Per-venue aggregates (revenue / bookings / status / performance table) */
  const perVenue = useMemo(() => {
    const map = new Map<string, { v: ApiVenue; total: number; revenue: number; cancelled: number; occ: number }>();
    for (const v of venues) {
      if (venueFilter !== 'all' && v.id !== venueFilter) continue;
      const a = analyticsByVenue[venueKey(v)];
      map.set(v.id, { v, total: 0, revenue: 0, cancelled: 0, occ: a ? a.kpis.occupancyPct.week : 0 });
    }
    for (const b of windowScoped) {
      const row = map.get(b.venueId || '');
      if (!row) continue;
      row.total += 1;
      if (isCancelled(b)) row.cancelled += 1;
      if (isPaid(b)) row.revenue += b.amount || 0;
    }
    return [...map.values()];
  }, [venues, venueFilter, windowScoped, analyticsByVenue]);

  const maxRevenue = useMemo(() => Math.max(1, ...perVenue.map((r) => r.revenue)), [perVenue]);
  const perfRows = useMemo(() => {
    return perVenue.map((r) => {
      const cancelRate = r.total ? (r.cancelled / r.total) * 100 : 0;
      const revShare = (r.revenue / maxRevenue) * 100;
      const score = Math.max(0, Math.min(100, Math.round(0.5 * r.occ + 0.3 * revShare + 0.2 * (100 - cancelRate))));
      return {
        id: r.v.id,
        name: r.v.displayName || 'Venue',
        rating: r.v.googleRating ?? null,
        total: r.total, revenue: r.revenue, cancelled: r.cancelled, occ: r.occ, score,
      };
    });
  }, [perVenue, maxRevenue]);

  const sortedPerf = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = q ? perfRows.filter((r) => r.name.toLowerCase().includes(q)) : perfRows;
    const { key, dir } = tableSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === 'name') return mul * a.name.localeCompare(b.name);
      return mul * (((a[key] as number) || 0) - ((b[key] as number) || 0));
    });
  }, [perfRows, tableSearch, tableSort]);

  const PAGE = 8;
  const pageCount = Math.max(1, Math.ceil(sortedPerf.length / PAGE));
  const page = Math.min(tablePage, pageCount - 1);
  const pagedPerf = sortedPerf.slice(page * PAGE, page * PAGE + PAGE);

  /* Status breakdown (window) */
  const statusBreakdown = useMemo(() => {
    let completed = 0, upcoming = 0, pending = 0, cancelled = 0;
    for (const b of windowScoped) {
      if (isCancelled(b)) cancelled += 1;
      else if (isPending(b)) pending += 1;
      else if (isPaid(b) && startTs(b) < nowTs) completed += 1;
      else upcoming += 1;
    }
    return [
      { label: 'Completed', value: completed, color: 'var(--lime)' },
      { label: 'Confirmed', value: upcoming, color: 'var(--primary)' },
      { label: 'Pending', value: pending, color: 'var(--coral)' },
      { label: 'Cancelled', value: cancelled, color: 'var(--surface-3)' },
      { label: 'No-show', value: 0, color: 'var(--star)' },
    ];
  }, [windowScoped, nowTs]);

  /* Peak booking hour (from real start times) */
  const peakHour = useMemo(() => {
    const hist = new Array(24).fill(0);
    for (const b of windowScoped) { const mn = toMin(b.startTime); if (mn != null) hist[Math.floor(mn / 60)] += 1; }
    let best = -1, bi = -1;
    hist.forEach((c, h) => { if (c > best) { best = c; bi = h; } });
    return best > 0 ? to12h(`${pad(bi)}:00`) : null;
  }, [windowScoped]);

  /* Quick insights (all derived from real data) */
  const insights = useMemo(() => {
    const out: { icon: string; tone: string; text: ReactNode }[] = [];
    const revRanked = [...perfRows].filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
    const scoreRanked = [...perfRows].sort((a, b) => b.score - a.score);
    const cancelRanked = [...perfRows].filter((r) => r.total >= 3).sort((a, b) => (a.cancelled / a.total) - (b.cancelled / b.total));
    if (kpis.totalDelta != null) {
      const up = kpis.totalDelta >= 0;
      out.push({ icon: up ? 'trending_up' : 'trending_down', tone: up ? '#16794c' : 'var(--coral)', text: <>Bookings {up ? 'up' : 'down'} <b>{Math.abs(kpis.totalDelta)}%</b> vs last {rangeWord}</> });
    }
    if (peakHour) out.push({ icon: 'schedule', tone: 'var(--primary)', text: <>Peak booking time is around <b>{peakHour}</b></> });
    if (revRanked[0]) out.push({ icon: 'payments', tone: 'var(--lime-ink)', text: <>Top revenue venue: <b>{revRanked[0].name}</b> ({money(revRanked[0].revenue)})</> });
    if (cancelRanked[0]) out.push({ icon: 'thumb_up', tone: '#16794c', text: <>Lowest cancellations: <b>{cancelRanked[0].name}</b></> });
    if (scoreRanked[0]) out.push({ icon: 'workspace_premium', tone: 'var(--star-ink)', text: <>Best performer: <b>{scoreRanked[0].name}</b> (score {scoreRanked[0].score})</> });
    return out;
  }, [perfRows, kpis.totalDelta, rangeWord, peakHour]);

  /* Recent activity (venue + status scoped, newest first) */
  const activity = useMemo(() => {
    return venueScoped
      .filter((b) => !isBlocked(b))
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .slice()
      .sort((a, b) => bookedTs(b) - bookedTs(a))
      .slice(0, 12);
  }, [venueScoped, statusFilter]);

  const onChanged = (updated: ApiBooking) => {
    setToast(true);
    setTimeout(() => setToast(false), 1800);
    updateBookingRow(updated);
    setDetail((d) => (d && d.id === updated.id ? { ...d, ...updated } : d));
  };

  /* Exports */
  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Venue', 'Court', 'Player', 'Date', 'Start', 'End', 'Amount', 'Status', 'Booked'];
    const lines = windowScoped.map((b) => [
      b.venueName || '', b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : ''),
      b.customerName || b.userName || (b.bookingType === 'manual' ? 'Walk-in' : 'Player'),
      b.date || '', b.startTime || '', b.endTime || '', b.amount ?? 0, b.status || '',
      toYMD(new Date(bookedTs(b))),
    ].map(esc).join(','));
    const csv = [header.map(esc).join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `bookings-${today}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const exportPdf = () => window.print();

  const setSort = (key: typeof tableSort.key) =>
    setTableSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Reports"
      subtitle="Financial & operational intelligence across your venues"
      action={(
        <div className="hidden lg:flex items-center gap-2">
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px] active:scale-95 transition-transform">
            <Icon name="download" size={15} /> CSV
          </button>
          <button type="button" onClick={exportPdf} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--primary)] text-white font-bold text-[13px] active:scale-95 transition-transform">
            <Icon name="picture_as_pdf" size={15} /> PDF Report
          </button>
        </div>
      )}
    />
  );

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<ErrorState title="Couldn't load bookings" message="We couldn't reach your venues. Tap to retry." onRetry={retry} /></div>;
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4 pb-6">

        {/* Filter bar (upper-right controls, per the reference) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-0 hidden sm:block" />
          <div className="w-[150px]">
            <Dropdown value={range} onChange={(v) => setRange(v as RangeId)} options={RANGE_OPTIONS}
              triggerClassName="h-9 px-3 rounded-full bg-[var(--surface)] border border-[var(--field-border)] text-[13px] font-semibold text-[var(--ink)] w-full" aria-label="Date range" />
          </div>
          <div className="w-[160px]">
            <Dropdown value={venueFilter} onChange={setVenueFilter} options={venueOptions}
              triggerClassName="h-9 px-3 rounded-full bg-[var(--surface)] border border-[var(--field-border)] text-[13px] font-semibold text-[var(--ink)] w-full" aria-label="Venue" />
          </div>
          <div className="w-[160px]">
            <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={STATUS_OPTIONS}
              triggerClassName="h-9 px-3 rounded-full bg-[var(--surface)] border border-[var(--field-border)] text-[13px] font-semibold text-[var(--ink)] w-full" aria-label="Booking status" />
          </div>
          {/* Mobile export buttons (desktop ones live in the header) */}
          <button type="button" onClick={exportCsv} aria-label="Export CSV" className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px]">
            <Icon name="download" size={15} /> CSV
          </button>
          <button type="button" onClick={exportPdf} aria-label="Export PDF" className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--primary)] text-white font-bold text-[13px]">
            <Icon name="picture_as_pdf" size={15} /> PDF
          </button>
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <KpiCard label="Total bookings" value={String(kpis.total)} icon="event" tone="primary" delta={hasPrev ? kpis.totalDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} />
          <KpiCard label="Upcoming" value={String(kpis.upcoming)} icon="upcoming" tone="blue" sub="Scheduled ahead" />
          <KpiCard label="Completed" value={String(kpis.completed)} icon="task_alt" tone="lime" delta={hasPrev ? kpis.completedDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} />
          <KpiCard label="Cancelled" value={String(kpis.cancelled)} icon="cancel" tone="coral" delta={hasPrev ? kpis.cancelledDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} invertDelta />
          <KpiCard label="Total revenue" value={money(kpis.rev)} icon="payments" tone="lime" delta={hasPrev ? kpis.revDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} />
          <KpiCard label="Avg booking value" value={money(kpis.avgValue)} icon="sell" tone="primary" delta={hasPrev ? kpis.avgDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} />
          <KpiCard label="Occupancy rate" value={`${kpis.occ}%`} icon="donut_large" tone="neutral" delta={kpis.occDelta} deltaSuffix="vs last week" />
          <KpiCard label="Cancellation rate" value={`${kpis.cancelRate}%`} icon="event_busy" tone="star" delta={hasPrev ? kpis.cancelRateDelta : undefined} deltaSuffix={`vs last ${rangeWord}`} invertDelta />
        </div>

        {/* Booking trends — large line chart */}
        <Panel
          title="Booking trends"
          icon="show_chart"
          right={(
            <Segmented
              className="w-full sm:w-auto sm:min-w-[248px]"
              value={gran}
              onChange={setGran}
              options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]}
            />
          )}
        >
          <LineChart points={trend.map((t) => t.value)} height={210} emptyLabel="No booking activity yet" />
          <div className="flex gap-[3px] mt-2">
            {trend.map((t, i) => (
              <div key={i} className="flex-1 text-center text-[10px] text-[var(--muted)] truncate">{t.label}</div>
            ))}
          </div>
        </Panel>

        {/* Revenue + distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Revenue by venue" icon="bar_chart">
            {perfRows.some((r) => r.revenue > 0) ? (
              <BarChart
                data={[...perfRows].sort((a, b) => b.revenue - a.revenue).map((r) => ({ label: shortName(r.name), segments: [{ value: r.revenue, color: 'var(--primary)' }] }))}
                formatValue={(n) => money(n)}
                maxLabels={perfRows.length}
              />
            ) : <div className="t-sm py-8 text-center">No revenue in this period yet</div>}
          </Panel>
          <Panel title="Bookings by venue" icon="stacked_bar_chart">
            {perfRows.some((r) => r.total > 0) ? (
              <BarChart
                data={[...perfRows].sort((a, b) => b.total - a.total).map((r) => ({ label: shortName(r.name), segments: [{ value: r.total, color: '#6c83ff' }] }))}
                maxLabels={perfRows.length}
              />
            ) : <div className="t-sm py-8 text-center">No bookings in this period yet</div>}
          </Panel>
        </div>

        {/* Status breakdown + quick insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Booking status" icon="donut_small">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <DonutChart segments={statusBreakdown} centerValue={String(statusBreakdown.reduce((t, s) => t + s.value, 0))} centerLabel="bookings" />
              <div className="flex-1 w-full space-y-2">
                {statusBreakdown.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} />
                      <span className="text-[var(--ink-2)] font-semibold truncate">{s.label}</span>
                    </span>
                    <span className="text-[var(--ink)] font-bold tabular-nums shrink-0">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Quick insights" icon="lightbulb">
            {insights.length === 0 ? (
              <div className="t-sm py-8 text-center">Insights appear once you have booking activity.</div>
            ) : (
              <div className="space-y-3">
                {insights.map((it, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-[9px] bg-[var(--surface-2)] flex items-center justify-center shrink-0" style={{ color: it.tone }}>
                      <Icon name={it.icon} size={15} />
                    </span>
                    <div className="text-[13.5px] text-[var(--ink-2)] leading-snug pt-1">{it.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Venue performance matrix */}
        <Panel
          title="Venue performance"
          icon="leaderboard"
          right={(
            <label className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full bg-[var(--surface-2)] text-[13px] w-[160px]">
              <Icon name="search" size={15} className="text-[var(--muted)] shrink-0" />
              <input
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.target.value); setTablePage(0); }}
                placeholder="Search venues"
                className="bg-transparent outline-none min-w-0 flex-1 text-[var(--ink)]"
              />
            </label>
          )}
        >
          {perfRows.length === 0 ? (
            <div className="t-sm py-8 text-center">No venues to report on yet.</div>
          ) : (
            <>
              {/* Mobile (<md): sort control + stacked cards — the table needs ~640px */}
              <div className="flex items-center gap-2 mb-3 md:hidden">
                <div className="flex-1 min-w-0">
                  <Dropdown
                    value={tableSort.key}
                    onChange={(v) => setTableSort({ key: v as typeof tableSort.key, dir: v === 'name' ? 'asc' : 'desc' })}
                    options={SORT_OPTIONS}
                    placeholder="Sort by"
                    triggerClassName="h-9 px-3 rounded-full bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--ink)] w-full"
                    aria-label="Sort venues by"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTableSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                  aria-label="Toggle sort direction"
                  className="h-9 w-9 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--ink)] shrink-0"
                >
                  <Icon name={tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={15} />
                </button>
              </div>
              <div className="space-y-2 md:hidden">
                {pagedPerf.map((r) => {
                  const st = scoreTone(r.score);
                  // The big right-hand figure mirrors the active sort so picking a
                  // sort visibly changes the cards (name falls back to revenue).
                  const metric = tableSort.key === 'name' ? 'revenue' : tableSort.key;
                  const primary =
                    metric === 'total' ? { value: String(r.total), label: r.total === 1 ? 'booking' : 'bookings' }
                    : metric === 'occ' ? { value: `${r.occ}%`, label: 'occupancy' }
                    : metric === 'cancelled' ? { value: String(r.cancelled), label: 'cancelled' }
                    : metric === 'score' ? { value: String(r.score), label: 'score', color: st.text }
                    : { value: money(r.revenue), label: 'revenue' };
                  const subs: { k: string; n: ReactNode }[] = [];
                  if (metric !== 'total') subs.push({ k: 'bookings', n: `${r.total} ${r.total === 1 ? 'booking' : 'bookings'}` });
                  if (metric !== 'revenue') subs.push({ k: 'revenue', n: money(r.revenue) });
                  if (metric !== 'occ') subs.push({ k: 'occ', n: `${r.occ}% occupancy` });
                  if (metric !== 'cancelled' && r.cancelled > 0) subs.push({ k: 'cancelled', n: <span className="text-[var(--coral)]">{r.cancelled} cancelled</span> });
                  if (r.rating != null) {
                    subs.push({
                      k: 'rating',
                      n: <span className="inline-flex items-center gap-0.5"><Icon name="star" size={11} className="text-[var(--star)]" />{r.rating.toFixed(1)}</span>,
                    });
                  }
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{r.name}</div>
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-[var(--muted)] mt-0.5">
                          {subs.map((s, i) => (
                            <span key={s.k} className="inline-flex items-center gap-1">
                              {i > 0 && <span>·</span>}
                              <span className="tabular-nums whitespace-nowrap">{s.n}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold tabular-nums text-[14px]" style={{ color: primary.color ?? 'var(--ink)' }}>{primary.value}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mt-0.5">{primary.label}</div>
                        {metric !== 'score' && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-[3px] mt-1 text-[11px] font-bold tabular-nums"
                            style={{ color: st.text, background: `color-mix(in srgb, ${st.bar} 14%, transparent)` }}
                          >
                            Score {r.score}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[640px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left">
                      {([
                        ['name', 'Venue'], ['total', 'Bookings'], ['revenue', 'Revenue'],
                        ['occ', 'Occupancy'], ['cancelled', 'Cancelled'], ['score', 'Score'],
                      ] as const).map(([key, label]) => (
                        <th key={key} className="sticky top-0 bg-[var(--surface)] z-[1] pb-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSort(key)}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${tableSort.key === key ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`}
                          >
                            {label}
                            {tableSort.key === key && <Icon name={tableSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={12} />}
                          </button>
                        </th>
                      ))}
                      <th className="sticky top-0 bg-[var(--surface)] z-[1] pb-2.5 pt-1 text-right">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Rating</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPerf.map((r) => {
                      const st = scoreTone(r.score);
                      return (
                        <tr key={r.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface-2)] transition-colors">
                          <td className="py-3 pr-3 font-semibold text-[var(--ink)] max-w-[180px] truncate">{r.name}</td>
                          <td className="py-3 pr-3 tabular-nums text-[var(--ink-2)]">{r.total}</td>
                          <td className="py-3 pr-3 tabular-nums font-semibold text-[var(--ink)]">{money(r.revenue)}</td>
                          <td className="py-3 pr-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden min-w-[48px]">
                                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${r.occ}%` }} />
                              </div>
                              <span className="tabular-nums text-[var(--muted)] text-[12px] w-9 text-right shrink-0">{r.occ}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-3 tabular-nums text-[var(--ink-2)]">{r.cancelled}</td>
                          <td className="py-3 pr-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden min-w-[48px]">
                                <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: st.bar }} />
                              </div>
                              <span className="tabular-nums font-bold text-[12px] w-6 text-right shrink-0" style={{ color: st.text }}>{r.score}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums text-[var(--ink-2)] whitespace-nowrap">
                            {r.rating != null ? <span className="inline-flex items-center gap-1 justify-end"><Icon name="star" size={12} className="text-[var(--star)]" /> {r.rating.toFixed(1)}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--hairline)]">
                  <span className="t-sm">Page {page + 1} of {pageCount}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page === 0} onClick={() => setTablePage(page - 1)} className="h-8 px-3 rounded-full bg-[var(--surface-2)] text-[13px] font-bold disabled:opacity-40">Prev</button>
                    <button type="button" disabled={page >= pageCount - 1} onClick={() => setTablePage(page + 1)} className="h-8 px-3 rounded-full bg-[var(--surface-2)] text-[13px] font-bold disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>

        {/* Recent activity — tap a row to open the booking (approve/decline/cancel in the sheet) */}
        <Panel title="Recent activity" icon="history">
          {activity.length === 0 ? (
            <div className="t-sm py-6 text-center">No recent booking activity.</div>
          ) : (
            <div className="space-y-1">
              {activity.map((b) => {
                const ev = activityMeta(b, nowTs);
                const person = b.customerName || b.userName || (b.bookingType === 'manual' ? 'Walk-in' : 'Player');
                return (
                  <button key={b.id} type="button" onClick={() => setDetail(b)} className="w-full flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: ev.bg, color: ev.color }}>
                      <Icon name={ev.icon} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-[var(--ink)] truncate"><b className="font-semibold">{ev.label}</b> · {person}</div>
                      <div className="t-sm truncate">{b.venueName}{b.date ? ` · ${prettyDate(b.date)}` : ''}</div>
                    </div>
                    <span className="t-sm shrink-0 whitespace-nowrap">{relTime(bookedTs(b), nowTs)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <OwnerBookingDetailSheet booking={detail} canManage={canManage} onClose={() => setDetail(null)} onChanged={onChanged} />
      <Toast message="Booking updated" show={toast} />
    </div>
  );
}

// Icon + label + tone for a booking's most recent lifecycle event.
function activityMeta(b: ApiBooking, now: number): { icon: string; label: string; color: string; bg: string } {
  const s = b.status;
  if (s === 'cancelled') return { icon: 'cancel', label: 'Booking cancelled', color: 'var(--coral)', bg: 'var(--coral-soft)' };
  if (s === 'pending_approval') return { icon: 'hourglass_empty', label: 'Booking requested', color: 'var(--coral)', bg: 'var(--coral-soft)' };
  if (s === 'awaiting_payment') return { icon: 'schedule', label: 'Awaiting payment', color: '#2952cc', bg: '#dde6ff' };
  const started = b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN;
  if ((s === 'confirmed' || s === 'paid') && !Number.isNaN(started) && started < now) return { icon: 'task_alt', label: 'Booking completed', color: 'var(--lime-ink)', bg: 'var(--lime-soft)' };
  return { icon: 'check_circle', label: 'Booking confirmed', color: 'var(--primary)', bg: 'var(--primary-tint)' };
}
