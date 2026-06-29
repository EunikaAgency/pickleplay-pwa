import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import { Toast } from '../../shared/components/ui/Toast';
import { Dropdown } from '../../shared/components/ui/Dropdown';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { CourtPicker } from '../../shared/components/ui/CourtPicker';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { OwnerStat } from './components/OwnerStat';
import { OwnerBookingRow } from './components/OwnerBookingRow';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  getVenueBookings, listCourts, createVenueBooking, createRecurringBooking,
  listRecurringBookings, cancelRecurringBooking,
  type ApiBooking, type ApiCourt, type ApiVenue, type VenueBookingPayload, type RecurringSeries,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { money, prettyDate, todayYMD, hoursBetween, addHours, snapToHour } from '../bookings/bookingDisplay';

interface OwnerFrontDeskScreenProps {
  /** Optional deep-link to a specific venue (slug or id); else the operator picks. */
  venueId?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

type SheetMode = 'manual' | 'block' | null;

const SOURCES: { id: NonNullable<VenueBookingPayload['bookingSource']>; label: string }[] = [
  { id: 'walk_in', label: 'Walk-in' },
  { id: 'phone', label: 'Phone' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'other', label: 'Other' },
];

// Day-of-week labels (0=Sunday), for recurring-series summaries.
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PAY_METHODS: { id: string; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'card', label: 'Card' },
];

/** Shift a YYYY-MM-DD by ±days (UTC-stepped so DST can't drop a day). */
function shiftDay(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startMin(b: ApiBooking): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(b.startTime || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// The front-desk / operator console: a single screen a venue's owner or staff
// (front-desk role included) uses to run the day — today's schedule, pending
// approvals, and the #1 meeting ask: record an off-platform booking (phone /
// Messenger / IG / walk-in) or block a slot so the court is reserved + double-
// booking-guarded without going through the player checkout.
export function OwnerFrontDeskScreen({ venueId, onNavigate, onBack }: OwnerFrontDeskScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry } = useOwnerDashboard({ withBookings: false });

  // Which venue the front desk is operating. Defaults to the deep-linked one, else
  // the first managed venue.
  const [activeKey, setActiveKey] = useState('');
  const activeVenue: ApiVenue | null = useMemo(() => {
    if (!venues.length) return null;
    const want = activeKey || venueId || '';
    return venues.find((v) => v.id === want || v.slug === want) ?? venues[0];
  }, [venues, activeKey, venueId]);
  const vref = activeVenue ? (activeVenue.slug || activeVenue.id) : '';

  const [viewDate, setViewDate] = useState(todayYMD());
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [bkStatus, setBkStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState<ApiBooking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [recurring, setRecurring] = useState<RecurringSeries[]>([]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // Recurring series (weekly regulars / leagues) for the active venue.
  const loadRecurring = useCallback(() => {
    if (!vref) { setRecurring([]); return; }
    listRecurringBookings(vref).then(setRecurring).catch(() => setRecurring([]));
  }, [vref]);
  useEffect(() => { loadRecurring(); }, [loadRecurring]);

  const cancelSeries = async (recurringId: string) => {
    try {
      await cancelRecurringBooking(recurringId);
      flash('Recurring series cancelled');
      loadRecurring();
      loadBookings();
    } catch {
      flash('Could not cancel the series');
    }
  };

  // Load the active venue's courts + full bookings whenever it changes.
  const loadBookings = useCallback(() => {
    if (!vref) return;
    setBkStatus('loading');
    getVenueBookings(vref)
      .then((rows) => { setBookings(rows); setBkStatus('ready'); })
      .catch(() => setBkStatus('error'));
  }, [vref]);

  useEffect(() => {
    if (!vref) return;
    let alive = true;
    setCourts([]);
    listCourts(vref).then((rows) => { if (alive) setCourts(rows); }).catch(() => { if (alive) setCourts([]); });
    return () => { alive = false; };
  }, [vref]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const today = todayYMD();
  const pending = useMemo(
    () => bookings.filter((b) => b.status === 'pending_approval').sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [bookings],
  );
  const dayRows = useMemo(
    () => bookings.filter((b) => b.date === viewDate && b.status !== 'cancelled').sort((a, b) => startMin(a) - startMin(b)),
    [bookings, viewDate],
  );
  const todayCount = useMemo(() => bookings.filter((b) => b.date === today && b.status !== 'cancelled').length, [bookings, today]);
  const manualToday = useMemo(() => bookings.filter((b) => b.date === today && b.bookingType === 'manual').length, [bookings, today]);

  const onRowChanged = (updated: ApiBooking) => {
    flash('Booking updated');
    setBookings((list) => list.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  const onCreated = (b: ApiBooking, mode: SheetMode) => {
    setSheet(null);
    flash(mode === 'block' ? 'Slot blocked' : 'Booking added');
    // The created row carries the venue context; merge it in (and jump the view to
    // its date so the operator sees it land on the schedule).
    setBookings((list) => [{ ...b, venueId: activeVenue?.id }, ...list]);
    if (b.date) setViewDate(b.date);
  };

  const header = <ScreenHeader onBack={onBack} eyebrow="Owner console" title="Front desk" subtitle={activeVenue?.displayName} />;

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<ErrorState title="Couldn't load your venues" message="Tap to retry." onRetry={retry} /></div>;
  }
  if (venues.length === 0) {
    return (
      <div className="scroll safe-top safe-bottom">
        {header}
        <div className="px-5">
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-6 text-center t-sm">
            No venues yet. Create a venue to start taking bookings.
            <div className="mt-3"><Button onClick={() => onNavigate('owner-new-venue')}>Create a venue</Button></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4">
        {/* Venue selector (only when the operator runs more than one venue) */}
        {venues.length > 1 && (
          <Dropdown
            value={activeVenue?.id || ''}
            onChange={(v) => setActiveKey(v)}
            options={venues.map((v) => ({ value: v.id, label: v.displayName }))}
            aria-label="Choose venue"
          />
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <OwnerStat label="Bookings today" value={todayCount} icon="calendar" tone="primary" />
          <OwnerStat label="Awaiting approval" value={pending.length} icon="bell" tone="coral" />
          <OwnerStat label="Manual today" value={manualToday} icon="edit" tone="lime" />
        </div>

        {/* Quick actions — the #1 meeting ask */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSheet('manual')}
            disabled={!canManage}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[var(--ink)] text-white font-heading font-bold text-[14px] disabled:opacity-50"
          >
            <Icon name="add" size={18} /> Add booking
          </button>
          <button
            type="button"
            onClick={() => setSheet('block')}
            disabled={!canManage}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[var(--surface-2)] text-[var(--ink)] font-heading font-bold text-[14px] disabled:opacity-50"
          >
            <Icon name="block" size={18} /> Block slot
          </button>
        </div>

        {bkStatus === 'error' ? (
          <ErrorState title="Couldn't load the schedule" message="Tap to retry." onRetry={loadBookings} />
        ) : (
          <>
            {/* Pending approvals */}
            {pending.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-[15px] text-[var(--ink)]">Awaiting approval</h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--coral)]/15 text-[var(--coral)]">{pending.length}</span>
                </div>
                {pending.slice(0, 8).map((b) => (
                  <OwnerBookingRow key={b.id} booking={b} canManage={canManage} showVenue={false} onChanged={onRowChanged} onOpen={setDetail} />
                ))}
              </section>
            )}

            {/* Date stepper + schedule */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-[15px] text-[var(--ink)]">Schedule</h2>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous day" onClick={() => setViewDate((d) => shiftDay(d, -1))} className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-2)]"><Icon name="back" size={15} /></button>
                  <button type="button" onClick={() => setViewDate(today)} className={`px-3 h-8 rounded-full text-[12px] font-bold ${viewDate === today ? 'bg-[var(--ink)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink-2)]'}`}>Today</button>
                  <button type="button" aria-label="Next day" onClick={() => setViewDate((d) => shiftDay(d, 1))} className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-2)]"><Icon name="forward" size={15} /></button>
                </div>
              </div>
              <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{prettyDate(viewDate)}</div>

              {bkStatus === 'loading' ? (
                <LoadingSkeleton variant="card" count={3} />
              ) : dayRows.length === 0 ? (
                <div className="rounded-xl bg-[var(--surface-2)] px-4 py-5 t-sm text-center">
                  Nothing booked for {prettyDate(viewDate)} yet. Use “Add booking” to record a phone or walk-in reservation.
                </div>
              ) : (
                <div className="space-y-3">
                  {dayRows.map((b) => (
                    <OwnerBookingRow key={b.id} booking={b} canManage={canManage} showVenue={false} onChanged={onRowChanged} onOpen={setDetail} />
                  ))}
                </div>
              )}
            </section>

            {/* Recurring series (weekly regulars / leagues) */}
            {recurring.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="font-heading font-bold text-[15px] text-[var(--ink)]">Recurring bookings</h2>
                <div className="space-y-2">
                  {recurring.map((s) => (
                    <div key={s.recurringId} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] px-3.5 py-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center shrink-0">
                        <Icon name="repeat" size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">
                          {s.bookingType === 'blocked' ? '🚫 ' : ''}{s.label}
                        </div>
                        <div className="t-sm truncate">
                          {s.dayOfWeek != null ? `${DOW_LABELS[s.dayOfWeek]}s` : 'Weekly'} · {s.startTime}–{s.endTime} · {s.courtName}
                          {s.upcomingCount > 0 ? ` · ${s.upcomingCount} upcoming` : ' · ended'}
                        </div>
                      </div>
                      {canManage && s.upcomingCount > 0 && (
                        <button
                          type="button"
                          onClick={() => cancelSeries(s.recurringId)}
                          className="text-[12px] font-bold text-[var(--coral)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--coral-soft)] shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {sheet && activeVenue && (
        <FrontDeskBookingSheet
          mode={sheet}
          venue={activeVenue}
          vref={vref}
          courts={courts}
          defaultDate={viewDate}
          onClose={() => setSheet(null)}
          onCreated={(b) => onCreated(b, sheet)}
          onRecurringCreated={() => { loadRecurring(); loadBookings(); }}
        />
      )}

      <OwnerBookingDetailSheet booking={detail} canManage={canManage} onClose={() => setDetail(null)} onChanged={onRowChanged} />

      <Toast message={toast || ''} show={!!toast} />
    </div>
  );
}

// The manual-booking / block-slot form. Shares court + date + time fields; the
// extra fields switch on `mode`. Posts to the owner-create endpoint, which runs
// the same double-booking guard the player flow uses.
function FrontDeskBookingSheet({ mode, venue, vref, courts, defaultDate, onClose, onCreated, onRecurringCreated }: {
  mode: 'manual' | 'block';
  venue: ApiVenue;
  vref: string;
  courts: ApiCourt[];
  defaultDate: string;
  onClose: () => void;
  onCreated: (b: ApiBooking) => void;
  onRecurringCreated?: () => void;
}) {
  const currency = venue.pricingCurrency ?? 'PHP';
  const isBlock = mode === 'block';

  const [courtId, setCourtId] = useState(courts[0]?.id ?? '');
  const [date, setDate] = useState(defaultDate);
  const [showCal, setShowCal] = useState(false);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<NonNullable<VenueBookingPayload['bookingSource']>>('walk_in');
  const [payMethod, setPayMethod] = useState('cash');
  const [blockReason, setBlockReason] = useState('');
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  // Recurring (weekly regular / league): repeat the same slot for N weeks.
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState('4');
  const [recurResult, setRecurResult] = useState<{ created: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default a court once they load.
  useEffect(() => { setCourtId((cur) => cur || courts[0]?.id || ''); }, [courts]);

  const selectedCourt = useMemo(() => courts.find((c) => c.id === courtId) ?? null, [courts, courtId]);
  const rate = selectedCourt?.hourlyRate != null ? selectedCourt.hourlyRate : (venue.priceFrom ?? 0);
  const hours = hoursBetween(startTime, endTime);
  const suggested = Math.round(rate * hours * 100) / 100;

  // Auto-fill the manual amount from the court rate × hours until the operator edits it.
  useEffect(() => {
    if (!amountTouched && !isBlock) setAmount(suggested ? String(suggested) : '');
  }, [suggested, amountTouched, isBlock]);

  const onStartChange = (v: string) => {
    setStartTime(v);
    if (hoursBetween(v, endTime) <= 0) setEndTime(addHours(v, 1));
  };

  const submit = async () => {
    setError(null);
    if (hours <= 0) { setError('End time must be after the start time.'); return; }
    if (!isBlock && !customerName.trim()) { setError('Add a customer name.'); return; }
    const weekCount = Math.max(2, Math.min(52, Number(weeks) || 0));
    if (repeat && weekCount < 2) { setError('Repeat for at least 2 weeks.'); return; }
    setBusy(true);
    try {
      // Recurring: generate the same weekly slot for N weeks (clashing weeks skipped).
      if (repeat) {
        const res = await createRecurringBooking(vref, {
          bookingType: isBlock ? 'blocked' : 'manual',
          courtId: courtId || undefined,
          startDate: date,
          startTime,
          endTime,
          weeks: weekCount,
          ...(isBlock
            ? { blockReason: blockReason.trim() || undefined }
            : {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || undefined,
                bookingSource: source,
                amount: amount === '' ? 0 : Number(amount),
              }),
        });
        setRecurResult({ created: res.createdCount, skipped: res.skippedCount });
        return;
      }
      const payload: VenueBookingPayload = isBlock
        ? {
            bookingType: 'blocked',
            courtId: courtId || undefined,
            date,
            startTime,
            endTime,
            blockReason: blockReason.trim() || undefined,
          }
        : {
            bookingType: 'manual',
            courtId: courtId || undefined,
            date,
            startTime,
            endTime,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || undefined,
            bookingSource: source,
            amount: amount === '' ? 0 : Number(amount),
            paymentMethod: payMethod,
          };
      const created = await createVenueBooking(vref, payload);
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isBlock ? 'Block a slot' : 'Add a booking'}
      subtitle={isBlock ? 'Make a court unavailable' : 'Phone / Messenger / IG / walk-in'}
      footer={
        <div>
          {error && <div className="text-[12px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>}
          {recurResult ? (
            <Button fullWidth onClick={() => { onRecurringCreated?.(); onClose(); }}>Done</Button>
          ) : (
            <Button fullWidth onClick={submit} disabled={busy}>
              {busy
                ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</>
                : repeat ? <><Icon name="calendar" size={16} /> Create {Math.max(2, Math.min(52, Number(weeks) || 0))}-week series</>
                : isBlock ? <><Icon name="block" size={16} /> Block slot</> : <><Icon name="check" size={16} /> Save booking</>}
            </Button>
          )}
        </div>
      }
    >
      {recurResult ? (
        <div className="px-5 pb-2 py-4 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center mx-auto">
            <Icon name="check" size={28} />
          </div>
          <div className="font-heading font-bold text-[17px] text-[var(--ink)]">Recurring series created</div>
          <div className="t-sm">
            <strong className="text-[var(--ink)]">{recurResult.created}</strong> {recurResult.created === 1 ? 'week' : 'weeks'} booked
            {recurResult.skipped > 0 && <> · <span className="text-[var(--coral)] font-bold">{recurResult.skipped} skipped</span> (already booked)</>}
          </div>
        </div>
      ) : (
      <div className="px-5 pb-2 space-y-4">
        {courts.length > 0 && (
          <div>
            <div className="lbl">Court</div>
            <CourtPicker courts={courts} value={courtId} onChange={setCourtId} priceFor={(c) => money(c.hourlyRate != null ? c.hourlyRate : (venue.priceFrom ?? 0), currency) + '/hr'} />
          </div>
        )}

        <div>
          <div className="lbl">Date</div>
          <button type="button" onClick={() => setShowCal((s) => !s)} className="control flex items-center justify-between text-left">
            <span className="font-semibold">{prettyDate(date)}</span>
            <Icon name="calendar" size={16} />
          </button>
          {showCal && (
            <div className="mt-2">
              <CalendarDatePicker value={date} min={todayYMD()} onChange={(d) => { setDate(d); setShowCal(false); }} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="lbl">Start time</div>
            <HourSelect aria-label="Start time" value={startTime} onChange={(v) => onStartChange(snapToHour(v))} />
          </div>
          <div>
            <div className="lbl">End time</div>
            <HourSelect aria-label="End time" placeholder="Set end" value={endTime} after={startTime} onChange={setEndTime} />
          </div>
        </div>

        {/* Recurring — repeat this slot weekly (regulars / leagues). */}
        <div>
          <label className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] cursor-pointer">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-[var(--ink)]">Repeat weekly</div>
              <div className="text-[12px] font-semibold text-[var(--muted)]">For weekly regulars or a league night</div>
            </div>
          </label>
          {repeat && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--muted)]">For</span>
              <input className="control w-20 text-center" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/[^\d]/g, ''))} aria-label="Number of weeks" />
              <span className="text-[13px] font-semibold text-[var(--muted)]">weeks (same day &amp; time)</span>
            </div>
          )}
        </div>

        {isBlock ? (
          <div>
            <div className="lbl">Reason (optional)</div>
            <input className="control" placeholder="Maintenance, private event…" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          </div>
        ) : (
          <>
            <div>
              <div className="lbl">Customer name</div>
              <input className="control" placeholder="Who's booking?" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <div className="lbl">Phone (optional)</div>
              <input className="control" inputMode="tel" placeholder="0917 …" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <div className="lbl">How did they book?</div>
              <div className="flex gap-1.5 flex-wrap">
                {SOURCES.map((s) => (
                  <Chip key={s.id} selected={source === s.id} onClick={() => setSource(s.id)}>{s.label}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="lbl">Payment</div>
              <div className="flex gap-1.5 flex-wrap">
                {PAY_METHODS.map((m) => (
                  <Chip key={m.id} selected={payMethod === m.id} onClick={() => setPayMethod(m.id)}>{m.label}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="lbl">Amount ({currency})</div>
              <input
                className="control"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => { setAmountTouched(true); setAmount(e.target.value.replace(/[^\d.]/g, '')); }}
              />
              {!amountTouched && suggested > 0 && (
                <div className="text-[11px] font-semibold text-[var(--muted)] mt-1">Suggested {money(suggested, currency)} ({money(rate, currency)}/hr × {hours} hr)</div>
              )}
            </div>
          </>
        )}
      </div>
      )}
    </BottomSheet>
  );
}
