import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Chip } from '../../shared/components/ui/Chip';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CourtPicker } from '../../shared/components/ui/CourtPicker';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import type { Navigate } from '../../shared/lib/navigation';
import {
  listAllVenues, createBooking, checkout, getSettings, listCourts, getVenueAvailabilityRange, getHours,
  getVenue, listSlotOverrides, recordDemandEvent,
  type ApiVenue, type ApiCourt, type AppSettings, type CheckoutCard, type OwnerHourEntry, type PaymentOption,
  type SlotPriceOverride,
} from '../../shared/lib/api';
import { resolveHourlyRate, perPlayerSurcharge } from '../../shared/lib/pricing';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import { locationLine, priceLabel, venueImage } from '../../shared/lib/venueDisplay';
import { addHours, hoursBetween, money, prettyDate, snapToHour, to12h, to24h, todayYMD } from './bookingDisplay';

interface BookCourtScreenProps {
  venueId?: string;
  /** Schedule prefill (date / 12h time label / hours). */
  date?: string;
  time?: string;            // 12h label like "6:30 PM"
  hours?: number;
  /** 'lobby' = the booking is a step toward hosting a lobby; the confirmation
   *  offers "Create your lobby" instead of just "View my bookings". */
  intent?: 'lobby';
  onNavigate: Navigate;
  onBack: () => void;
}

const TITLE_BY_STEP = ['Court & time', 'Summary', 'Checkout'];

/** A venue is bookable only if it has a rate (decision: require a price). */
function isBookable(v: ApiVenue): boolean {
  return v.priceFrom != null;
}

/** Brand from a card number's IIN prefix (best-effort, for the saved-card label). */
function cardBrand(num: string): string {
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^6/.test(num)) return 'Discover';
  return 'Card';
}

/** Mask a card down to what we store on a request-to-book (brand + last4 only). */
function maskCard(card: CheckoutCard): { brand: string; last4: string } | undefined {
  const n = (card.number || '').replace(/\D/g, '');
  if (!n) return undefined;
  return { brand: cardBrand(n), last4: n.slice(-4) };
}

export function BookCourtScreen({ venueId, date: dateProp, time: timeProp, intent, onNavigate, onBack }: BookCourtScreenProps) {
  const [step, setStep] = useState(0);

  // Bookable venues (priced only) for the picker.
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(venueId ?? '');
  const [picking, setPicking] = useState(!venueId); // show the list when nothing preselected
  const [query, setQuery] = useState('');

  // Schedule — prefilled from the game's chosen date/time when present. The user
  // picks a start + end hour directly; the duration (hours) is derived from them.
  // Courts are booked by the hour, so times snap to the hour (no minutes).
  const initialStart = snapToHour(to24h(timeProp) || '18:00');
  const [date, setDate] = useState(dateProp || todayYMD());
  const [startTime, setStartTime] = useState(initialStart);
  // End starts empty; it auto-fills to start + 1h the moment the user changes the
  // start (see onStartChange), and is otherwise picked by hand.
  const [endTime, setEndTime] = useState('');

  // Courts at the selected venue. Each court is booked independently, so the
  // booker picks one and it drives both availability and the booking. Venues
  // with no defined courts fall back to a venue-level booking (no picker).
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [courtId, setCourtId] = useState('');
  // Half-court / split-court sub-unit: undefined = whole court, 0..N-1 = sub-unit.
  const [subUnitIndex, setSubUnitIndex] = useState<number | undefined>(undefined);
  // Equipment rental add-on (V2).
  const [includeEquipment, setIncludeEquipment] = useState(false);

  // VenueHour pricing blocks — fetched when the venue is picked, so the rate shown
  // to the booker reflects the actual time-block price (not just the flat venue rate).
  const [venueHours, setVenueHours] = useState<OwnerHourEntry[]>([]);
  // Manual surge / slot price overrides for the chosen date, and whether the booker
  // is a member of this venue — both feed the pricing engine.
  const [overrides, setOverrides] = useState<SlotPriceOverride[]>([]);
  const [viewerIsMember, setViewerIsMember] = useState(false);
  // Party size — drives the per-player surcharge (and is stored on the booking).
  const [playerCount, setPlayerCount] = useState(1);

  // Checkout.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({ number: '', expiry: '', cvc: '' });
  const [cardTouched, setCardTouched] = useState(false);

  // Lifecycle.
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ confirmed: boolean; bookingId: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    // venuesLoading already starts true; the effect runs once on mount.
    listAllVenues()
      .then((items) => {
        if (!alive) return;
        const bookable = items.filter(isBookable);
        // Always keep a deep-linked venue (e.g. a game's winning court) selectable,
        // even if it has no published rate — it just books at ₱0.
        const preselected = venueId ? items.find((v) => v.id === venueId) : null;
        const list = preselected && !bookable.some((v) => v.id === venueId) ? [preselected, ...bookable] : bookable;
        setVenues(list);
        setSelectedId((prev) => prev || (venueId ?? '') || list[0]?.id || '');
      })
      .catch(() => { /* picker shows an empty-state */ })
      .finally(() => { if (alive) setVenuesLoading(false); });
    return () => { alive = false; };
  }, [venueId]);

  // Load the selected venue's courts; default to the first so a court is always
  // chosen (the booker can switch). Reset to none while a fresh venue loads.
  useEffect(() => {
    if (!selectedId) { setCourts([]); setCourtId(''); return; }
    let alive = true;
    setCourts([]); setCourtId('');
    listCourts(selectedId)
      .then((rows) => { if (!alive) return; setCourts(rows); setCourtId(rows[0]?.id ?? ''); })
      .catch(() => { if (alive) { setCourts([]); setCourtId(''); } });
    return () => { alive = false; };
  }, [selectedId]);

  // Reset sub-unit pick when changing courts (default to whole-court).
  useEffect(() => { setSubUnitIndex(undefined); }, [courtId]);

  // Load the venue's hourly pricing blocks so the rate reflects time-based pricing.
  useEffect(() => {
    if (!selectedId) { setVenueHours([]); return; }
    let alive = true;
    getHours(selectedId)
      .then((rows) => { if (alive) setVenueHours(rows); })
      .catch(() => { if (alive) setVenueHours([]); });
    return () => { alive = false; };
  }, [selectedId]);

  // Membership status drives member pricing — fetched once per venue (the detail
  // endpoint computes the viewer's membership server-side).
  useEffect(() => {
    if (!selectedId) { setViewerIsMember(false); return; }
    let alive = true;
    getVenue(selectedId)
      .then((v) => { if (alive) setViewerIsMember(!!v.viewerIsMember); })
      .catch(() => { if (alive) setViewerIsMember(false); });
    return () => { alive = false; };
  }, [selectedId]);

  // Manual surge / slot price overrides for the chosen date — re-fetched per date.
  useEffect(() => {
    if (!selectedId || !date) { setOverrides([]); return; }
    let alive = true;
    listSlotOverrides(selectedId, date)
      .then((rows) => { if (alive) setOverrides(rows); })
      .catch(() => { if (alive) setOverrides([]); });
    return () => { alive = false; };
  }, [selectedId, date]);

  // Load the payment mode once, before checkout, so we can pre-fill the demo card.
  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        if (s.paymentTestMode) setCard({ ...s.testCard });
      })
      .catch(() => { /* default to live card form if settings are unreachable */ });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);
  const currency = selected?.pricingCurrency ?? 'PHP';
  // Price is tied to the chosen court when it has its own rate; otherwise the
  // venue's flat priceFrom applies (and when there are no courts at all).
  const selectedCourt = useMemo(() => courts.find((c) => c.id === courtId) ?? null, [courts, courtId]);
  // Effective hourly rate via the shared pricing engine: surge → time-block →
  // holiday → weekend → sub-unit → court → venue, then the member discount.
  const rateInfo = useMemo(() => resolveHourlyRate({
    venue: selected, court: selectedCourt, subUnitIndex, hours: venueHours, overrides,
    date, startTime, isMember: viewerIsMember,
  }), [selected, selectedCourt, subUnitIndex, venueHours, overrides, date, startTime, viewerIsMember]);
  const rate = rateInfo.rate;
  const hours = hoursBetween(startTime, endTime);
  const equipAmount = includeEquipment ? (Number(selected?.equipmentRentalPrice) ?? 0) : 0;
  const courtTotal = Math.round(rate * hours * 100) / 100;
  // Per-player surcharge — ₱ per extra player beyond the venue's included headcount.
  const surcharge = perPlayerSurcharge(selected, playerCount);
  // `subtotal` is the venue's price (court + equipment + per-player surcharge) — what
  // the venue earns and what's stored as the booking `amount`. The platform service
  // fee is added on top to form the grand total the player pays.
  const subtotal = Math.round((courtTotal + equipAmount + surcharge) * 100) / 100;
  const isTest = settings?.paymentTestMode ?? false;
  const serviceFeePercent = settings?.serviceFeePercent ?? 7;
  const serviceFee = Math.round(subtotal * (serviceFeePercent / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + serviceFee) * 100) / 100;
  // Approval venues use request-to-book: capture the card now, pay after the
  // owner approves (the last step "requests" instead of charging). A chosen court
  // can override the venue policy — 'manual' always requests, 'auto' always instant;
  // 'inherit' (or no court picked) falls back to the venue's setting.
  const requiresApproval = selectedCourt?.approvalMode === 'manual' ? true
    : selectedCourt?.approvalMode === 'auto' ? false
    : !!selected?.requireBookingApproval;

  // Payment options the venue offers (deposit / full / pay-at-venue). Only applied
  // on the instant-book path — approval venues always pay in full after the owner
  // accepts. Defaults to full-pay only when the venue hasn't configured options.
  const paymentChoices: PaymentOption[] = useMemo(() => {
    if (requiresApproval) return ['full'];
    const configured = (selected?.paymentOptions ?? []).filter((o): o is PaymentOption => o === 'full' || o === 'deposit' || o === 'pay_at_venue');
    return configured.length ? configured : ['full'];
  }, [selected, requiresApproval]);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('full');
  // Keep the chosen option valid as the venue/court (and thus options) change.
  useEffect(() => {
    setPaymentOption((prev) => (paymentChoices.includes(prev) ? prev : paymentChoices[0]));
  }, [paymentChoices]);

  const depositPercent = Number(selected?.depositPercent) || 50;
  // How much is charged online now vs owed at the venue, by chosen option.
  const amountDueNow = paymentOption === 'pay_at_venue' ? 0
    : paymentOption === 'deposit' ? Math.round(grandTotal * (depositPercent / 100) * 100) / 100
    : grandTotal;
  const balanceDue = Math.round((grandTotal - amountDueNow) * 100) / 100;

  // Live availability for the chosen court (or the venue pool when none) on this
  // date → greys out hours that court is already taken.
  const { availability, minBookableHour, endDisabledFor, rangeBlocked, firstFreeHour, isPast, isFull } = useVenueAvailability(selected?.id, date, courtId || undefined);
  const slotUnavailable = rangeBlocked(startTime, endTime);
  const startInPast = Number(startTime.split(':')[0]) < minBookableHour;

  // Per-hour classification for the Start picker: hide past hours, but keep booked
  // ones visible-and-greyed with a "Booked" tag so it's clear *why* they're gone.
  const startHourInfo = (h: number): { hide?: boolean; disabled?: boolean; note?: string } => {
    if (isPast(h)) return { hide: true };
    if (isFull(h)) return { disabled: true, note: 'Booked' };
    return {};
  };

  // Fully-booked day markers for the calendar — fetched per visible month (and
  // re-fetched when the court changes, since "full" is court-scoped when one's
  // chosen). Keyed by venue+court+month so stale months don't bleed in.
  const [calMonth, setCalMonth] = useState<{ y: number; m: number } | null>(null);
  const [fullDays, setFullDays] = useState<Set<string>>(new Set());
  // Stable handler so the calendar's month effect doesn't re-fire each render;
  // only updates when the visible month actually changes (keeps `calMonth`
  // identity stable, so the fetch effect below doesn't loop).
  const handleMonthChange = useCallback((y: number, m: number) => {
    setCalMonth((prev) => (prev && prev.y === y && prev.m === m ? prev : { y, m }));
  }, []);
  useEffect(() => {
    if (!selected?.id || !calMonth) { setFullDays(new Set()); return; }
    const pad = (n: number) => String(n).padStart(2, '0');
    const last = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const from = `${calMonth.y}-${pad(calMonth.m + 1)}-01`;
    const to = `${calMonth.y}-${pad(calMonth.m + 1)}-${pad(last)}`;
    let alive = true;
    getVenueAvailabilityRange(selected.id, from, to, courtId || undefined)
      .then((r) => { if (alive) setFullDays(new Set(r.days.filter((d) => d.full).map((d) => d.date))); })
      .catch(() => { if (alive) setFullDays(new Set()); });
    return () => { alive = false; };
  }, [selected?.id, courtId, calMonth]);

  // If the chosen court leaves the current start hour booked (e.g. the default
  // 6 PM on a court that's taken until 9), jump the start to the first free hour
  // so the end picker isn't entirely blocked. End resets to empty for the user.
  // Keep the start on a valid hour: prefer the first free + future hour when
  // availability is loaded; otherwise just bump off an already-passed hour today.
  useEffect(() => {
    const cur = Number(startTime.split(':')[0]);
    const target = firstFreeHour(cur) ?? (cur < minBookableHour && minBookableHour <= 23 ? minBookableHour : null);
    if (target != null && target !== cur) { setStartTime(`${String(target).padStart(2, '0')}:00`); setEndTime(''); }
  }, [availability, startTime, firstFreeHour, minBookableHour]);

  // Keep a positive duration: if a new start lands at/after the end, push the end out an hour.
  const onStartChange = (v: string) => {
    setStartTime(v);
    if (hoursBetween(v, endTime) <= 0) setEndTime(addHours(v, 1));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) => `${v.displayName} ${locationLine(v)}`.toLowerCase().includes(q));
  }, [venues, query]);

  const totalSteps = 3;
  const back = () => {
    if (step > 0) {
      // Demand signal: user left checkout without completing.
      if (step === 2 && selected) {
        recordDemandEvent({ type: 'checkout_abandoned', venueId: selected.id, courtId: courtId || undefined, date, startHour: startTime });
      }
      setError(null);
      setStep((s) => s - 1);
    } else {
      // Demand signal: user abandoned the booking flow entirely.
      if (selected) {
        recordDemandEvent({ type: 'checkout_abandoned', venueId: selected.id, courtId: courtId || undefined, date, startHour: startTime });
      }
      onBack();
    }
  };

  const payAtVenue = paymentOption === 'pay_at_venue';

  const submit = async () => {
    if (!selected) { setError('Please choose a court.'); return; }
    // Approval venues need a card on file (charged after approval); enforce it
    // up front in live mode (test mode pre-fills the demo card). Pay-at-venue
    // charges nothing now, so it never needs a card.
    if (requiresApproval && !isTest && !card.number) {
      setError('Add your card — the venue charges it after they approve your request.');
      return;
    }
    if (!requiresApproval && !payAtVenue && !isTest && !card.number) {
      setError('Enter your card details to pay.');
      return;
    }
    setSubmitting(true);
    setError(null);
    // Demand signal: a player is attempting to book this venue.
    recordDemandEvent({ type: 'booking_attempt', venueId: selected.id, courtId: courtId || undefined, date, startHour: startTime });
    try {
      const booking = await createBooking({
        venueId: selected.id,
        courtId: courtId || undefined,
        subUnitIndex,
        date,
        startTime,
        endTime,
        playerCount,
        // `amount` is the venue's price (drives revenue); the fee + split are extra.
        amount: subtotal,
        serviceFeeAmount: serviceFee,
        paymentOption: requiresApproval ? 'full' : paymentOption,
        amountPaid: requiresApproval ? 0 : amountDueNow,
        balanceDue: requiresApproval ? 0 : balanceDue,
        paymentMethod: payAtVenue ? 'pay_at_venue' : isTest ? 'test_card' : 'card',
        // Save the card on the request so paying after approval is one tap.
        card: requiresApproval ? maskCard(card) : undefined,
        // Equipment rental add-on (V2).
        hasEquipmentRental: includeEquipment,
        equipmentRentalAmount: includeEquipment ? (Number(selected?.equipmentRentalPrice) ?? 0) : 0,
      });
      // Request-to-book: no payment now — the owner approves, then the player
      // pays within the venue's window. Land on the "requested" confirmation.
      if (requiresApproval) {
        setDone({ confirmed: false, bookingId: booking.id });
        recordDemandEvent({ type: 'booking_completed', venueId: selected.id, courtId: courtId || undefined });
        return;
      }
      // Pay-at-venue: the booking is already confirmed at creation and nothing is
      // charged online, so skip checkout entirely.
      if (payAtVenue) {
        setDone({ confirmed: true, bookingId: booking.id });
        recordDemandEvent({ type: 'booking_completed', venueId: selected.id, courtId: courtId || undefined });
        return;
      }
      const result = await checkout({
        bookingId: booking.id,
        amount: amountDueNow,
        currency,
        method: isTest ? 'test_card' : 'card',
        card,
      });
      const confirmed = result.booking?.status === 'confirmed';
      const bookingId = result.booking?.id ?? booking.id;
      setDone({ confirmed, bookingId });
      recordDemandEvent({ type: 'booking_completed', venueId: selected.id, courtId: courtId || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step === 0) {
      if (!selected) { setError('Please choose a venue.'); return; }
      if (courts.length > 0 && !courtId) { setError('Please choose a court.'); return; }
      if (!date) { setError('Please pick a date.'); return; }
      if (!startTime) { setError('Please pick a start time.'); return; }
      if (!endTime) { setError('Please pick an end time.'); return; }
      if (!(hours > 0)) { setError('End time must be after the start time.'); return; }
      if (startInPast) { setError('That start time has already passed. Please pick a later time.'); return; }
      if (slotUnavailable) { setError('That time is fully booked. Please pick a free slot.'); return; }
    }
    setError(null);
    if (step < totalSteps - 1) {
      // Demand signal: user reached checkout (step 2 = payment).
      if (step === 1 && selected) {
        recordDemandEvent({ type: 'checkout_started', venueId: selected.id, courtId: courtId || undefined, date, startHour: startTime });
      }
      setStep((s) => s + 1);
    } else void submit();
  };

  if (done) {
    // When the booking was a step toward hosting a lobby, lead with "Create your
    // lobby" (only once the court is actually confirmed) so the flow hands
    // straight back to the create form, pre-locked to this reservation.
    const lobbyHandoff = intent === 'lobby' && done.confirmed && done.bookingId;
    const lobbyAction = lobbyHandoff
      ? [{
          label: 'Create your lobby',
          variant: 'dark' as const,
          onClick: () => onNavigate('create-game', { bookingId: done.bookingId! }, { replace: true }),
        }]
      : [];
    return (
      <CompletionScreen
        icon={done.confirmed ? 'check' : 'clock'}
        title={done.confirmed ? 'Booking confirmed!' : 'Booking requested'}
        description={
          done.confirmed
            ? lobbyHandoff
              ? 'Your court is booked — now set up the game you want to host.'
              : 'Your court is booked. You can see it under My bookings.'
            : 'Your request was sent and is awaiting venue approval.'
        }
        actions={[
          ...lobbyAction,
          // `replace` drops the finished wizard from the back stack so Back from
          // My bookings doesn't re-open it at step 1.
          { label: 'View my bookings', variant: lobbyHandoff ? ('outline' as const) : ('dark' as const), onClick: () => onNavigate('my-bookings', undefined, { replace: true }) },
          { label: 'Done', variant: 'outline' as const, onClick: onBack },
        ]}
      />
    );
  }

  const setCardField = (k: keyof CheckoutCard, v: string) => {
    setCardTouched(true);
    setCard((c) => ({ ...c, [k]: v }));
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={back}
        backIcon={step === 0 ? 'close' : 'back'}
        eyebrow={`Step ${step + 1} of ${totalSteps}`}
        title={TITLE_BY_STEP[step]}
      />

      <div className="px-5 pb-4">
        <ProgressBar value={(step + 1) / totalSteps} />
      </div>

      {/* ─── Step 0: court & schedule ─────────────────────────── */}
      {step === 0 && (
        <>
          <div className="field">
            <div className="flex items-center justify-between mb-2">
              <div className="lbl mb-0!">Venue</div>
              {selected && !picking && (
                <button type="button" className="chip" onClick={() => setPicking(true)}>
                  <Icon name="edit" size={12} /> Change
                </button>
              )}
            </div>

            {venuesLoading ? (
              <LoadingSkeleton variant="card" count={3} />
            ) : venues.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold py-2">
                No bookable courts right now — only venues with published rates can be booked.
              </div>
            ) : selected && !picking ? (
              <SelectedVenueCard venue={selected} currency={currency} />
            ) : (
              <>
                <div className="relative mb-3">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    <Icon name="search" size={16} />
                  </span>
                  <input
                    className="control pl-10!"
                    placeholder="Search a venue by name or area"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search venues"
                  />
                </div>
                {filtered.length === 0 ? (
                  <div className="text-[13px] text-[var(--muted)] font-semibold py-3 text-center">
                    No venues match “{query.trim()}”.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                    {filtered.map((v) => {
                      const photo = venueImage(v);
                      const sel = v.id === selectedId;
                      const meta = [priceLabel(v), locationLine(v) || 'Court'].filter(Boolean).join(' · ');
                      return (
                        <button
                          key={v.id}
                          onClick={() => { setSelectedId(v.id); setPicking(false); }}
                          className={`time-pick text-left px-3! py-2.5! flex items-center gap-3 ${
                            sel ? 'bg-[var(--ink)]! text-white!' : 'bg-[var(--surface)]! text-[var(--ink)]!'
                          }`}
                        >
                          <div
                            className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white/90 overflow-hidden bg-[var(--surface-3)]"
                            style={photo ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                          >
                            {!photo && <Icon name="paddle" size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-heading font-semibold text-[14px] truncate">{v.displayName}</div>
                            <div className="text-[11px] opacity-70 font-semibold truncate">{meta}</div>
                          </div>
                          {sel && <Icon name="check" size={16} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="field">
            <div className="lbl">Date</div>
            <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-[var(--lime-soft)] px-4 py-3 text-[var(--lime-ink)]">
              <Icon name="calendar" size={20} />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] opacity-70">Selected date</span>
                <span className="font-heading font-bold text-[18px]">{prettyDate(date)}</span>
              </div>
            </div>
            <CalendarDatePicker
              value={date}
              min={todayYMD()}
              onChange={setDate}
              fullDays={fullDays}
              onMonthChange={handleMonthChange}
            />
            {fullDays.size > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] inline-block" />
                {courtId ? 'This court is fully booked on dotted days' : 'All courts booked on dotted days'}
              </div>
            )}
          </div>

          {courts.length > 0 && (
            <div className="field">
              <div className="lbl">Court</div>
              <CourtPicker
                courts={courts}
                value={courtId}
                onChange={setCourtId}
                priceFor={(c) => money(c.hourlyRate != null ? c.hourlyRate : (selected?.priceFrom ?? 0), currency) + '/hr'}
              />
            </div>
          )}

          {/* Split-court sub-unit picker — shown when the chosen court can be divided into half-courts. */}
          {selectedCourt?.isSplittable && (
            <div className="field">
              <div className="lbl">Court unit</div>
              <div className="flex gap-1.5 flex-wrap">
                <Chip selected={subUnitIndex == null} onClick={() => setSubUnitIndex(undefined)}>
                  {subUnitIndex == null && <Icon name="check" size={12} />} Full court
                </Chip>
                {Array.from({ length: selectedCourt.splitCount ?? 2 }, (_, i) => (
                  <Chip key={i} selected={subUnitIndex === i} onClick={() => setSubUnitIndex(i)}>
                    {subUnitIndex === i && <Icon name="check" size={12} />} Half {i + 1}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Party size — drives the per-player surcharge when the venue charges one. */}
          {Number(selected?.perPlayerFee) > 0 && (
            <div className="field">
              <div className="lbl">Players</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                  <button type="button" aria-label="Fewer players" onClick={() => setPlayerCount((n) => Math.max(1, n - 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)] disabled:opacity-40" disabled={playerCount <= 1}>
                    <Icon name="minus" size={18} />
                  </button>
                  <div className="w-12 text-center font-heading font-bold text-[17px] text-[var(--ink)] tabular-nums">{playerCount}</div>
                  <button type="button" aria-label="More players" onClick={() => setPlayerCount((n) => Math.min(50, n + 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)]">
                    <Icon name="plus" size={18} />
                  </button>
                </div>
                <div className="text-[12px] font-semibold text-[var(--muted)]">
                  {money(Number(selected?.perPlayerFee) || 0, currency)} per player past {Number(selected?.perPlayerFeeThreshold) || 1}
                </div>
              </div>
            </div>
          )}

          {/* Member-rate banner — the booker is a member and gets the venue's discount. */}
          {rateInfo.memberApplied && (
            <div className="field">
              <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--lime-soft)] px-4 py-2.5 text-[var(--lime-ink)]">
                <Icon name="star" size={18} />
                <span className="text-[13px] font-bold">Member rate — {rateInfo.memberDiscountPercent}% off applied</span>
              </div>
            </div>
          )}

          <div className="field">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="lbl">Start time</div>
                <HourSelect aria-label="Start time" value={startTime} onChange={onStartChange} hourInfo={startHourInfo} />
              </div>
              <div>
                <div className="lbl">End time</div>
                <HourSelect aria-label="End time" placeholder="Set end" value={endTime} after={startTime} onChange={setEndTime} disabled={endDisabledFor(startTime)} />
              </div>
            </div>
            {slotUnavailable && (
              <div className="mt-2 t-sm text-[var(--coral)] font-bold">That time is fully booked — pick a free slot.</div>
            )}
            {/* V3: open-play passive note. */}
            {selected?.openPlayPrice != null && Number(selected.openPlayPrice) > 0 && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[12px] font-semibold text-[var(--muted)]">
                <Icon name="groups" size={14} className="inline mr-1 align-text-bottom" />
                Open play available: {money(Number(selected.openPlayPrice), currency)}/player/session. Check the Open Play tab for scheduled sessions.
              </div>
            )}
          </div>

          {selected && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 flex items-center justify-between">
                {hours > 0 ? (
                  <>
                    <div className="text-[13px] font-semibold text-[var(--muted)]">
                      {money(rate, currency)}/hr × {hours} hr
                    </div>
                    <div className="font-heading font-bold text-[22px] text-[var(--ink)]">{money(subtotal, currency)}</div>
                  </>
                ) : !endTime ? (
                  <div className="text-[13px] font-semibold text-[var(--muted)]">
                    Pick an end time to see the total.
                  </div>
                ) : (
                  <div className="text-[13px] font-semibold text-[var(--coral)]">
                    End time must be after the start time.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Step 1: review ───────────────────────────────────── */}
      {step === 1 && selected && (
        <>
        {/* Equipment rental add-on toggle (V2). */}
        {((selected as any)?.equipmentRentalPrice > 0) && (
          <div className="field">
            <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] cursor-pointer">
              <input type="checkbox" checked={includeEquipment} onChange={(e) => setIncludeEquipment(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[var(--ink)]">Add equipment rental</div>
                <div className="text-[12px] font-semibold text-[var(--muted)]">Paddles &amp; balls — +{money(Number((selected as any).equipmentRentalPrice), currency)}</div>
              </div>
            </label>
          </div>
        )}
        <div className="field">
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
            <ReviewRow label="Court" value={selected.displayName} sub={locationLine(selected) || undefined} />
            {subUnitIndex != null && <ReviewRow label="Unit" value={`Half ${subUnitIndex + 1}`} />}
            <ReviewRow label="Date" value={prettyDate(date)} />
            <ReviewRow label="Time" value={`${to12h(startTime)} – ${to12h(endTime)}`} sub={`${hours} hr`} />
            <ReviewRow
              label="Rate"
              value={`${money(rate, currency)}/hr`}
              sub={[
                rateInfo.source === 'surge' ? 'Adjusted rate' : rateInfo.source === 'holiday' ? 'Holiday rate' : rateInfo.source === 'weekend' ? 'Weekend rate' : rateInfo.source === 'timeBlock' ? 'Time-block rate' : rateInfo.source === 'subUnit' ? 'Sub-unit rate' : null,
                rateInfo.memberApplied ? `Member −${rateInfo.memberDiscountPercent}%` : null,
              ].filter(Boolean).join(' · ') || undefined}
            />
            {surcharge > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t-[0.5px] border-[var(--hairline)]">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--muted)]">
                  <Icon name="groups" size={14} /> Extra players ({Math.max(0, playerCount - (Number(selected?.perPlayerFeeThreshold) || 1))} × {money(Number(selected?.perPlayerFee) || 0, currency)})
                </div>
                <div className="font-heading font-semibold text-[15px] tabular-nums">{money(surcharge, currency)}</div>
              </div>
            )}
            {(selected as any)?.pricingTaxLabel && <div className="px-4 py-2 t-sm text-[var(--muted)] border-t-[0.5px] border-[var(--hairline)]">{(selected as any).pricingTaxLabel}</div>}
            {((selected as any)?.cancellationWindowHours != null || (selected as any)?.refundPercent != null) && (
              <div className="px-4 py-2.5 t-sm border-t-[0.5px] border-[var(--hairline)] flex items-start gap-2">
                <Icon name="info" size={14} className="text-[var(--muted)] mt-0.5 shrink-0" />
                <span>Free cancellation up to <strong>{(selected as any).cancellationWindowHours ?? 24}h</strong> before — <strong>{(selected as any).refundPercent ?? 100}%</strong> refund.</span>
              </div>
            )}
            {equipAmount > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t-[0.5px] border-[var(--hairline)]">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--muted)]">
                  <Icon name="sports_tennis" size={14} /> Equipment rental
                </div>
                <div className="font-heading font-semibold text-[15px]">{money(equipAmount, currency)}</div>
              </div>
            )}
            {/* Price breakdown — venue subtotal + the platform service fee. */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t-[0.5px] border-[var(--hairline)]">
              <div className="text-[13px] font-semibold text-[var(--muted)]">Subtotal</div>
              <div className="font-heading font-semibold text-[15px] tabular-nums">{money(subtotal, currency)}</div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t-[0.5px] border-[var(--hairline)]">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)]">
                Service fee ({serviceFeePercent}%)
              </div>
              <div className="font-heading font-semibold text-[15px] tabular-nums">{money(serviceFee, currency)}</div>
            </div>
            <div className="flex items-center justify-between px-4 py-4 bg-[var(--ink)] text-white">
              <div className="font-heading font-semibold text-[15px]">Total</div>
              <div className="font-heading font-bold text-[22px] tabular-nums">{money(grandTotal, currency)}</div>
            </div>
          </div>
        </div>

        {/* Payment option — only when the venue offers more than full-pay (instant-book). */}
        {paymentChoices.length > 1 && (
          <div className="field">
            <div className="lbl">How would you like to pay?</div>
            <div className="flex flex-col gap-2">
              {paymentChoices.map((opt) => {
                const sel = paymentOption === opt;
                const meta = opt === 'full'
                  ? { title: 'Pay in full', desc: `${money(grandTotal, currency)} now`, icon: 'lock' }
                  : opt === 'deposit'
                  ? { title: `Pay ${depositPercent}% deposit`, desc: `${money(Math.round(grandTotal * (depositPercent / 100) * 100) / 100, currency)} now · ${money(Math.round((grandTotal - grandTotal * (depositPercent / 100)) * 100) / 100, currency)} at the venue`, icon: 'payments' }
                  : { title: 'Pay at the venue', desc: `Reserve now · ${money(grandTotal, currency)} on arrival`, icon: 'storefront' };
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPaymentOption(opt)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left ${sel ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)]'}`}
                  >
                    <Icon name={meta.icon} size={18} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-[14px]">{meta.title}</div>
                      <div className={`text-[12px] font-semibold ${sel ? 'opacity-80' : 'text-[var(--muted)]'}`}>{meta.desc}</div>
                    </div>
                    {sel && <Icon name="check" size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </>
      )}

      {/* ─── Step 2: checkout ─────────────────────────────────── */}
      {step === 2 && selected && (
        <>
          {requiresApproval && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--primary-tint)] border-[0.5px] border-[var(--primary)] px-4 py-3 flex items-start gap-3">
                <Icon name="clock" size={20} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--ink)]">This venue reviews bookings</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">
                    You won't be charged now. We'll save your card and notify you to pay once the venue approves your request.
                  </div>
                </div>
              </div>
            </div>
          )}
          {payAtVenue && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface-2)] border-[0.5px] border-[var(--hairline)] px-4 py-3 flex items-start gap-3">
                <Icon name="storefront" size={20} className="mt-0.5 shrink-0 text-[var(--ink-2)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--ink)]">Pay at the venue</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">
                    Your court is reserved now — pay {money(grandTotal, currency)} when you arrive. No card needed.
                  </div>
                </div>
              </div>
            </div>
          )}
          {isTest && !payAtVenue && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--lime)]/20 border-[0.5px] border-[var(--lime)] px-4 py-3 flex items-start gap-3">
                <Icon name="science" size={20} className="mt-0.5 shrink-0 text-[var(--ink)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--ink)]">Test mode</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">
                    A demo card is pre-filled and no real charge is made.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-[14px] truncate">{selected.displayName}</div>
                  <div className="text-[11px] opacity-70 font-semibold">{prettyDate(date)} · {to12h(startTime)} · {hours} hr</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{payAtVenue ? 'Due at venue' : paymentOption === 'deposit' ? 'Pay now' : 'Total'}</div>
                  <div className="font-heading font-bold text-[18px] text-[var(--ink)] tabular-nums">{money(payAtVenue ? grandTotal : amountDueNow, currency)}</div>
                </div>
              </div>
              {paymentOption === 'deposit' && balanceDue > 0 && (
                <div className="mt-2 pt-2 border-t-[0.5px] border-[var(--hairline)] flex items-center justify-between text-[12px] font-semibold text-[var(--muted)]">
                  <span>Balance at the venue</span>
                  <span className="tabular-nums">{money(balanceDue, currency)}</span>
                </div>
              )}
            </div>

            {!payAtVenue && (
              <>
                <div className="lbl">Card number</div>
                <input
                  className="control"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  value={card.number ?? ''}
                  onChange={(e) => setCardField('number', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input
                    className="control"
                    placeholder="MM/YY"
                    value={card.expiry ?? ''}
                    onChange={(e) => setCardField('expiry', e.target.value)}
                    aria-label="Card expiry"
                  />
                  <input
                    className="control"
                    inputMode="numeric"
                    placeholder="CVC"
                    value={card.cvc ?? ''}
                    onChange={(e) => setCardField('cvc', e.target.value)}
                    aria-label="Card CVC"
                  />
                </div>
                {!isTest && cardTouched && !card.number && (
                  <div className="text-[12px] text-[var(--coral)] font-semibold mt-2">Enter your card details to pay.</div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div className="app-action-bar">
        {error && <div className="text-[13px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>}
        <Button fullWidth onClick={next} disabled={submitting || venuesLoading || venues.length === 0}>
          {step === totalSteps - 1 ? (
            submitting ? (
              <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> {requiresApproval ? 'Sending…' : payAtVenue ? 'Reserving…' : 'Processing…'}</>
            ) : requiresApproval ? (
              <><Icon name="calendar" size={16} /> Request booking</>
            ) : payAtVenue ? (
              <><Icon name="calendar" size={16} /> Reserve court</>
            ) : (
              <><Icon name="lock" size={16} /> Pay {money(amountDueNow, currency)}</>
            )
          ) : (
            <>Continue <Icon name="forward" size={16} /></>
          )}
        </Button>
      </div>
    </div>
  );
}

function SelectedVenueCard({ venue, currency }: { venue: ApiVenue; currency: string }) {
  const photo = venueImage(venue);
  return (
    <div className="time-pick px-3! py-2.5! flex items-center gap-3 bg-[var(--ink)]! text-white!">
      <div
        className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white/90 overflow-hidden bg-[var(--surface-3)]"
        style={photo ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!photo && <Icon name="paddle" size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-[14px] truncate">{venue.displayName}</div>
        <div className="text-[11px] opacity-70 font-semibold truncate">
          {[money(venue.priceFrom ?? 0, currency) + '/hr', locationLine(venue) || 'Court'].filter(Boolean).join(' · ')}
        </div>
      </div>
      <Icon name="check" size={16} />
    </div>
  );
}

function ReviewRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
      <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="text-right min-w-0">
        <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{value}</div>
        {sub && <div className="text-[11px] font-semibold text-[var(--muted)]">{sub}</div>}
      </div>
    </div>
  );
}
