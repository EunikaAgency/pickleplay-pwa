import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import { Dropdown } from '../../shared/components/ui/Dropdown';
import { Toast } from '../../shared/components/ui/Toast';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { CourtPicker } from '../../shared/components/ui/CourtPicker';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  listCourts, getHours, listSlotOverrides, createVenueBooking, createSlotOverride, getVenueBookings,
  type ApiBooking, type ApiVenue, type OwnerCourt, type VenueBookingPayload,
  type OwnerHourEntry, type SlotPriceOverride,
} from '../../shared/lib/api';
import { resolveHourlyRate } from '../../shared/lib/pricing';
import type { Navigate } from '../../shared/lib/navigation';
import { money, prettyDate, todayYMD, hoursBetween, addHours, snapToHour, to12h } from '../bookings/bookingDisplay';

interface OwnerManualReservationScreenProps {
  /** Optional deep-link to a specific venue (slug or id); else the owner picks. */
  venueId?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const SOURCES: { id: NonNullable<VenueBookingPayload['bookingSource']>; label: string }[] = [
  { id: 'walk_in', label: 'Walk-in' },
  { id: 'phone', label: 'Phone' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'other', label: 'Other' },
];

const PAY_METHODS: { id: string; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'card', label: 'Card' },
];

function personName(b: ApiBooking): string {
  return b.customerName || b.userName || (b.bookingType === 'manual' ? 'Walk-in' : b.bookingType === 'blocked' ? 'Blocked' : 'Player');
}
function courtLabel(b: ApiBooking): string {
  return b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : 'Any court');
}

// A dedicated owner screen for recording a manual reservation (phone / walk-in /
// off-platform booking). Unlike the front-desk sheet, on save it ALSO writes a
// `note: 'Reserved'` slot override for the same court/date/time — the exact
// artifact the Pricing Override grid (/owner/pricing) paints green — so the
// reserved hours line up across the schedule and the pricing table.
//
// Desktop lays out as two columns: the form on the left, and a live listing of
// the venue's upcoming reservations on the right (stacked on mobile/tablet).
export function OwnerManualReservationScreen({ venueId, onNavigate, onBack }: OwnerManualReservationScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry } = useOwnerDashboard({ withBookings: false, withAnalytics: false });

  // Which venue we're reserving on: the deep-linked one, else the first managed.
  const [activeKey, setActiveKey] = useState('');
  const activeVenue: ApiVenue | null = useMemo(() => {
    if (!venues.length) return null;
    const want = activeKey || venueId || '';
    return venues.find((v) => v.id === want || v.slug === want) ?? venues[0];
  }, [venues, activeKey, venueId]);
  const vref = activeVenue ? (activeVenue.slug || activeVenue.id) : '';
  const currency = activeVenue?.pricingCurrency ?? 'PHP';

  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [venueHours, setVenueHours] = useState<OwnerHourEntry[]>([]);
  const [overrides, setOverrides] = useState<SlotPriceOverride[]>([]);

  // Right column: the venue's reservations.
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [bkStatus, setBkStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Form fields.
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState(todayYMD());
  const [showCal, setShowCal] = useState(false);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<NonNullable<VenueBookingPayload['bookingSource']>>('walk_in');
  const [payMethod, setPayMethod] = useState('cash');
  const [amountInput, setAmountInput] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // Load the venue's courts, hours (rate engine), overrides, and bookings. Each
  // falls back to an empty resolve when there's no venue so no setState runs
  // synchronously in the effect body (only inside the async callback).
  useEffect(() => {
    let alive = true;
    const p = vref ? listCourts(vref) : Promise.resolve([] as OwnerCourt[]);
    p.then((rows) => { if (alive) { setCourts(rows); setCourtId(rows[0]?.id ?? ''); } })
      .catch(() => { if (alive) { setCourts([]); setCourtId(''); } });
    return () => { alive = false; };
  }, [vref]);

  useEffect(() => {
    let alive = true;
    const p = vref ? getHours(vref) : Promise.resolve([] as OwnerHourEntry[]);
    p.then((rows) => { if (alive) setVenueHours(rows); }).catch(() => { if (alive) setVenueHours([]); });
    return () => { alive = false; };
  }, [vref]);

  useEffect(() => {
    let alive = true;
    const p = vref && date ? listSlotOverrides(vref, date) : Promise.resolve([] as SlotPriceOverride[]);
    p.then((rows) => { if (alive) setOverrides(rows); }).catch(() => { if (alive) setOverrides([]); });
    return () => { alive = false; };
  }, [vref, date]);

  useEffect(() => {
    let alive = true;
    const p = vref ? getVenueBookings(vref) : Promise.resolve([] as ApiBooking[]);
    p.then((rows) => { if (alive) { setBookings(rows); setBkStatus('ready'); } })
      .catch(() => { if (alive) { setBookings([]); setBkStatus('error'); } });
    return () => { alive = false; };
  }, [vref]);

  const refreshBookings = () => {
    if (!vref) return;
    getVenueBookings(vref).then((rows) => { setBookings(rows); setBkStatus('ready'); }).catch(() => { /* keep prior list */ });
  };

  const selectedCourt = useMemo(() => courts.find((c) => c.id === courtId) ?? null, [courts, courtId]);
  const rateInfo = useMemo(() => resolveHourlyRate({
    venue: activeVenue, court: selectedCourt, hours: venueHours, overrides,
    date, startTime, isMember: false,
  }), [activeVenue, selectedCourt, venueHours, overrides, date, startTime]);
  const rate = rateInfo.rate;
  const hours = hoursBetween(startTime, endTime);
  const suggested = Math.round(rate * hours * 100) / 100;

  // The amount shown: the owner's input once they've edited it, otherwise the
  // live court-rate × hours suggestion (derived — no ref/effect needed).
  const amountValue = amountTouched ? amountInput : (suggested ? String(suggested) : '');

  const today = todayYMD();
  const upcoming = useMemo(
    () => bookings
      .filter((b) => b.status !== 'cancelled' && (b.date ?? '') >= today)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      .slice(0, 25),
    [bookings, today],
  );

  const onStartChange = (v: string) => {
    setStartTime(v);
    if (hoursBetween(v, endTime) <= 0) setEndTime(addHours(v, 1));
  };

  const submit = async () => {
    setError(null);
    if (hours <= 0) { setError('End time must be after the start time.'); return; }
    if (!customerName.trim()) { setError('Add a customer name.'); return; }
    setBusy(true);
    try {
      // 1) The real reservation — server runs the same double-booking guard as the
      //    player checkout, so a conflict throws here before we paint anything.
      const payload: VenueBookingPayload = {
        bookingType: 'manual',
        courtId: courtId || undefined,
        date,
        startTime,
        endTime,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        bookingSource: source,
        amount: amountValue === '' ? 0 : Number(amountValue),
        paymentMethod: payMethod,
      };
      await createVenueBooking(vref, payload);

      // 2) Paint the Pricing Override grid — a `note: 'Reserved'` override (price 0)
      //    for the same court/date/window. Best-effort: the booking is the source
      //    of truth, so a paint failure still counts as a successful reservation.
      let painted = true;
      try {
        await createSlotOverride(vref, { courtId: courtId || undefined, date, startTime, endTime, price: 0, note: 'Reserved' });
      } catch {
        painted = false;
      }

      // Refresh the listing, reset the customer fields, and confirm via toast.
      refreshBookings();
      setCustomerName('');
      setCustomerPhone('');
      setAmountInput('');
      setAmountTouched(false);
      flash(painted ? 'Reservation saved · painted on the pricing grid' : 'Reservation saved · pricing grid not updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const header = <ScreenHeader onBack={onBack} eyebrow="Owner console" title="Manual reservation" subtitle={activeVenue?.displayName} />;

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
            No venues yet. Create a venue to start taking reservations.
            <div className="mt-3"><Button onClick={() => onNavigate('owner-new-venue')}>Create a venue</Button></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 pt-3 pb-10 w-full grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-10 lg:px-14">
        {/* LEFT — the reservation form */}
        <div className="min-w-0">
          {venues.length > 1 && (
            <div className="field px-0!">
              <div className="lbl">Venue</div>
              <Dropdown
                value={activeVenue?.id || ''}
                onChange={(v) => setActiveKey(v)}
                options={venues.map((v) => ({ value: v.id, label: v.displayName }))}
                triggerClassName="h-12 w-full px-4 rounded-[14px] border border-[var(--field-border)] bg-[var(--surface)] text-[15px] font-semibold text-[var(--ink)]"
                aria-label="Choose venue"
              />
            </div>
          )}

          <div className="field px-0!">
            <div className="lbl">Court</div>
            {courts.length > 0 ? (
              <CourtPicker courts={courts} value={courtId} onChange={setCourtId} gridClassName="grid-cols-3 lg:grid-cols-4" priceFor={(c) => money(c.hourlyRate != null ? c.hourlyRate : (activeVenue?.priceFrom ?? 0), currency) + '/hr'} />
            ) : (
              <div className="rounded-[14px] border border-[var(--field-border)] bg-[var(--surface-2)] px-4 py-3 text-[13px] text-[var(--muted)]">
                No courts at this venue yet — this reservation will apply venue-wide.{' '}
                <button type="button" onClick={() => onNavigate('owner-venue', { id: vref, tab: 'courts' })} className="font-bold text-[#f59e0b] underline">Add a court</button>
              </div>
            )}
          </div>

          <div className="field px-0!">
            <div className="lbl">Date</div>
            <button type="button" onClick={() => setShowCal((s) => !s)} className="control flex items-center justify-between text-left">
              <span className="flex flex-col">
                <strong className="text-[15px] text-[var(--ink)]">{prettyDate(date)}</strong>
                <small className="text-[12px] text-[var(--muted)]">{date}</small>
              </span>
              <Icon name="calendar" size={18} />
            </button>
            {showCal && (
              <div className="mt-2">
                <CalendarDatePicker value={date} min={todayYMD()} onChange={(d) => { setDate(d); setShowCal(false); }} />
              </div>
            )}
          </div>

          <div className="field px-0!">
            <div className="lbl">Time</div>
            <div className="grid grid-cols-2 gap-3">
              <HourSelect aria-label="Start time" value={startTime} onChange={(v) => onStartChange(snapToHour(v))} />
              <HourSelect aria-label="End time" placeholder="Set end" value={endTime} after={startTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="field px-0!">
            <div className="lbl">Customer name</div>
            <input className="control" placeholder="Who's reserving?" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div className="field px-0!">
            <div className="lbl">Phone (optional)</div>
            <input className="control" inputMode="tel" placeholder="0917 …" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <div className="field px-0!">
            <div className="lbl">How did they book?</div>
            <div className="flex gap-1.5 flex-wrap">
              {SOURCES.map((s) => (
                <Chip key={s.id} selected={source === s.id} onClick={() => setSource(s.id)}>{s.label}</Chip>
              ))}
            </div>
          </div>

          <div className="field px-0!">
            <div className="lbl">Payment</div>
            <div className="flex gap-1.5 flex-wrap">
              {PAY_METHODS.map((m) => (
                <Chip key={m.id} selected={payMethod === m.id} onClick={() => setPayMethod(m.id)}>{m.label}</Chip>
              ))}
            </div>
          </div>

          <div className="field px-0!">
            <div className="lbl">Amount ({currency})</div>
            <input
              className="control"
              inputMode="numeric"
              placeholder="0"
              value={amountValue}
              onChange={(e) => { setAmountTouched(true); setAmountInput(e.target.value.replace(/[^\d.]/g, '')); }}
            />
            {!amountTouched && suggested > 0 && (
              <div className="text-[11px] font-semibold text-[var(--muted)] mt-1">Suggested {money(suggested, currency)} ({money(rate, currency)}/hr × {hours} hr)</div>
            )}
          </div>

          <div className="field px-0!">
            {error && <div className="text-[12px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>}
            <Button fullWidth onClick={submit} disabled={busy || !canManage}>
              {busy
                ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</>
                : <><Icon name="check" size={16} /> Save reservation</>}
            </Button>
            <div className="text-[11px] text-[var(--muted)] mt-2 text-center">
              {canManage ? 'Also marks these hours “Reserved” on your pricing grid.' : "You don't have permission to record reservations."}
            </div>
          </div>
        </div>

        {/* RIGHT — the venue's upcoming reservations. On desktop the grid row is
            sized by the form (left), and this panel is absolutely stretched to that
            height so the list scrolls internally once it overflows; on mobile it's
            normal flow below the form. */}
        <aside className="min-w-0 lg:relative">
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm overflow-hidden flex flex-col lg:absolute lg:inset-0">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--hairline)]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Icon name="calendar" size={16} />
                </span>
                <div className="min-w-0">
                  <div className="font-heading font-extrabold text-[14px] text-[var(--ink)] leading-tight">Reservations</div>
                  <div className="text-[11px] text-[var(--muted)] leading-tight">Upcoming at this venue</div>
                </div>
              </div>
              <button type="button" onClick={() => onNavigate('owner-pricing')} className="text-[11px] font-extrabold text-[#f59e0b] shrink-0">Pricing grid</button>
            </div>

            {bkStatus === 'loading' ? (
              <div className="p-4"><LoadingSkeleton variant="card" count={3} /></div>
            ) : bkStatus === 'error' ? (
              <div className="px-4 py-6 t-sm text-center">Couldn't load reservations. <button type="button" onClick={refreshBookings} className="font-bold text-[#f59e0b] underline">Retry</button></div>
            ) : upcoming.length === 0 ? (
              <div className="px-4 py-8 t-sm text-center">No upcoming reservations for this venue yet.</div>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto">
                {upcoming.map((b) => {
                  const tag = b.bookingType === 'manual' ? 'Manual' : b.bookingType === 'blocked' ? 'Blocked' : null;
                  return (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--hairline)] last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-extrabold text-[var(--ink)] truncate">{personName(b)}</span>
                          {tag && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)] shrink-0">{tag}</span>}
                        </div>
                        <div className="text-[12px] text-[var(--muted)] truncate">
                          {prettyDate(b.date || '')} · {to12h(b.startTime || '')}–{to12h(b.endTime || '')} · {courtLabel(b)}
                        </div>
                      </div>
                      <div className="text-[13px] font-extrabold text-[var(--ink)] shrink-0 tabular-nums">{money(b.amount || 0, currency)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Toast message={toast || ''} show={!!toast} />
    </div>
  );
}
