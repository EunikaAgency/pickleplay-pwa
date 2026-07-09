import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  listAllVenues, createBooking, checkout, getSettings, getVenueAvailabilityRange,
  joinWaitlist, createGame,
  type ApiVenue, type AppSettings, type CheckoutCard, type PaymentOption,
} from '../../shared/lib/api';
import { useVenueBookingContext } from './useVenueBookingContext';
import { useBookingPricing } from './useBookingPricing';
import { mapBookingError } from './bookingErrors';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import { useDemandTracking } from '../../shared/hooks/useDemandTracking';
import { locationLine, priceLabel, venueImage } from '../../shared/lib/venueDisplay';
import { addHours, hoursBetween, money, prettyDate, snapToHour, to12h, to24h, todayYMD } from './bookingDisplay';

interface BookCourtScreenProps {
  venueId?: string;
  /** Schedule prefill (date / 12h time label / hours). */
  date?: string;
  time?: string;            // 12h label like "6:30 PM"
  hours?: number;
  /** Pre-select this court in the CourtPicker (from the map filter's available-courts badge). */
  courtId?: string;
  /** 'lobby' = the booking is a step toward hosting a lobby; the confirmation
   *  offers "Make Open Play" instead of just "View my bookings". */
  intent?: 'lobby';
  onNavigate: Navigate;
  onBack: () => void;
}

type BookingMode = 'public_game' | 'open_play';

const BOOKING_MODE_OPTIONS: { value: BookingMode; label: string; icon: string; desc: string }[] = [
  { value: 'public_game', label: 'Hosted game', icon: 'globe', desc: 'Book the court, then publish a game with set slots players can join.' },
  { value: 'open_play', label: 'Open play session', icon: 'groups', desc: 'Book the court for drop-in play — open to everyone, or private for your group.' },
];

// ── Open-play game details (step 1 when bookingMode === 'open_play') ──
const SKILLS = ['Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+', 'Open'];

// ── Public-game details (step 1 when bookingMode === 'public_game') ──
type GameFormat = 'bracketing' | 'round_robin' | 'mini_tournament';
const FORMAT_OPTIONS: { v: GameFormat; label: string; icon: string }[] = [
  { v: 'bracketing', label: 'Bracketing', icon: '🏆' },
  { v: 'round_robin', label: 'Round-robin', icon: '🔁' },
  { v: 'mini_tournament', label: 'Mini-tournament', icon: '🎯' },
];
const MIN_SLOTS = 2;
const MAX_SLOTS = 16;

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

export function BookCourtScreen({ venueId, date: dateProp, time: timeProp, hours: hoursProp, courtId: courtIdProp, intent, onNavigate, onBack }: BookCourtScreenProps) {
  const { trackBookingAttempt, trackBookingCompleted, trackCheckoutStarted, trackCheckoutAbandoned } = useDemandTracking();
  const [step, setStep] = useState(0);
  const [bookingMode, setBookingMode] = useState<BookingMode>(intent === 'lobby' ? 'public_game' : 'open_play');

  // Bookable venues (priced only) for the picker. The full directory is pulled
  // only when the picker is actually shown (no deep-linked venue, or the user taps
  // "Change") — a deep link uses the venue-detail fetch instead (see #5).
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(venueId ?? '');
  const [picking, setPicking] = useState(!venueId); // show the list when nothing preselected
  const [query, setQuery] = useState('');
  // The directory is "loading" whenever the picker is shown but hasn't loaded yet
  // (derived, so the effect never has to synchronously setState a loading flag).
  const directoryLoading = picking && !directoryLoaded;

  // Schedule — prefilled from the game's chosen date/time when present. The user
  // picks a start + end hour directly; the duration (hours) is derived from them.
  // Courts are booked by the hour, so times snap to the hour (no minutes).
  const initialStart = snapToHour(to24h(timeProp) || '18:00');
  const [date, setDate] = useState(dateProp || todayYMD());
  const [startTime, setStartTime] = useState(initialStart);
  // End starts empty; it auto-fills to start + 1h the moment the user changes the
  // start (see onStartChange), and is otherwise picked by hand.
  // When arriving from the date/time filter, pre-fill the end time from the filter window.
  const [endTime, setEndTime] = useState(
    hoursProp && hoursProp > 0 ? addHours(initialStart, hoursProp) : '',
  );

  // The booked court. Each court is booked independently, so the booker picks one
  // and it drives both availability and the booking. Venues with no defined courts
  // fall back to a venue-level booking (no picker). Courts + venue hours + slot
  // overrides + membership all come from useVenueBookingContext (below).
  const [courtId, setCourtId] = useState(courtIdProp ?? '');
  // Half-court / split-court sub-unit: undefined = whole court, 0..N-1 = sub-unit.
  const [subUnitIndex, setSubUnitIndex] = useState<number | undefined>(undefined);
  // Equipment rental add-on (V2).
  const [includeEquipment, setIncludeEquipment] = useState(false);
  // Party size — drives the per-player surcharge (and is stored on the booking).
  const [playerCount, setPlayerCount] = useState(1);

  // Open-play game details (collected in step 1 when bookingMode === 'open_play').
  // The details step carries an open/private toggle: private = a plain court
  // reservation for the host's own group — no game is published.
  const [opPrivate, setOpPrivate] = useState(false);
  const [opSkill, setOpSkill] = useState('3.0–3.5');
  const [opName, setOpName] = useState('');
  const [opDesc, setOpDesc] = useState('');
  // Soft headcount goal for open play ("aiming for 8") — not a cap.
  const [opTarget, setOpTarget] = useState(8);
  // Public-game details (collected in step 1 when bookingMode === 'public_game').
  // Name/description reuse opName/opDesc (only one mode is active at a time).
  const [pgFormat, setPgFormat] = useState<GameFormat | null>(null);
  const [pgSlots, setPgSlots] = useState(4);
  const [pgSkill, setPgSkill] = useState('Open');
  // Vibe applies to both open play and public games.
  const [gameVibe, setGameVibe] = useState<'casual' | 'competitive'>('casual');

  // Checkout.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({ number: '', expiry: '', cvc: '' });
  const [cardTouched, setCardTouched] = useState(false);

  // Lifecycle.
  const [error, setError] = useState<string | null>(null);
  // Waitlist join — shown when a slot is fully booked.
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ confirmed: boolean; bookingId: string | null; gameId?: string | null } | null>(null);

  // Load the full venue directory only when the picker is on screen (no deep-linked
  // venue, or the user tapped "Change") and it hasn't loaded yet. A deep link
  // (venueId set) skips this entirely — the selected venue comes from the context
  // hook's single getVenue, not a whole-directory pull.
  useEffect(() => {
    if (directoryLoaded || !picking) return;
    let alive = true;
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
      .finally(() => { if (alive) setDirectoryLoaded(true); });
    return () => { alive = false; };
  }, [directoryLoaded, picking, venueId]);

  // Per-venue (+ per-date override) data — courts, structured hours, slot overrides,
  // and the viewer's membership — in one keyed hook (see #5/#6). Replaces four
  // separate effects + their render-phase reset pairs.
  const { detail, courts, venueHours, overrides, viewerIsMember } = useVenueBookingContext(selectedId, date);

  // Reset the court pick when the venue changes; default to the first court (or the
  // deep-linked courtId) once the new venue's courts load, so a court is always
  // chosen for availability + booking.
  const [prevSelectedId_courts, setPrevSelectedId_courts] = useState(selectedId);
  if (selectedId !== prevSelectedId_courts) {
    setPrevSelectedId_courts(selectedId);
    setCourtId('');
  }
  // Once the venue's courts load (courtsKey changes), default the pick to the
  // deep-linked court if valid, else keep a still-valid pick, else the first court —
  // done during render (guarded on the courts set) to avoid a cascading effect.
  const courtsKey = courts.map((c) => c.id).join(',');
  const [prevCourtsKey, setPrevCourtsKey] = useState(courtsKey);
  if (courtsKey !== prevCourtsKey) {
    setPrevCourtsKey(courtsKey);
    if (courts.length) {
      const target = courtIdProp && courts.some((c) => c.id === courtIdProp)
        ? courtIdProp
        : (courtId && courts.some((c) => c.id === courtId) ? courtId : courts[0].id);
      if (target !== courtId) setCourtId(target);
    }
  }

  // Reset sub-unit pick when changing courts (default to whole-court).
  const [prevCourtId, setPrevCourtId] = useState(courtId);
  if (courtId !== prevCourtId) {
    setPrevCourtId(courtId);
    setSubUnitIndex(undefined);
  }

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

  // The selected venue: the detail from the context hook (a superset with courts +
  // membership), falling back to the picker's list item until it loads.
  const selected = detail ?? venues.find((v) => v.id === selectedId) ?? null;
  const currency = selected?.pricingCurrency ?? 'PHP';
  // Price is tied to the chosen court when it has its own rate; otherwise the
  // venue's flat priceFrom applies (and when there are no courts at all).
  const selectedCourt = useMemo(() => courts.find((c) => c.id === courtId) ?? null, [courts, courtId]);

  // All booking money math (rate → blended hours → per-player surcharge → service
  // fee → grand total) lives in useBookingPricing — a pure function of the
  // venue/court context + the chosen schedule + settings.
  const pricing = useBookingPricing({
    venue: selected, court: selectedCourt, subUnitIndex, venueHours, overrides,
    date, startTime, endTime, isMember: viewerIsMember, playerCount, includeEquipment, settings,
  });
  const { rateInfo, rate, hours, hourlyBreakdown, equipAmount, surcharge, subtotal, serviceFeePercent, serviceFee, grandTotal } = pricing;

  const isTest = settings?.paymentTestMode ?? false;
  // Per-court approval — a court set to 'manual' requires owner approval before the
  // player pays; anything else confirms instantly.
  const requiresApproval = selectedCourt?.approvalMode === 'manual';

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
  const prevPaymentChoices = useRef(paymentChoices);
  if (paymentChoices !== prevPaymentChoices.current) {
    prevPaymentChoices.current = paymentChoices;
    if (!paymentChoices.includes(paymentOption)) {
      setPaymentOption(paymentChoices[0]);
    }
  }

  const depositPercent = Number(selected?.depositPercent) || 50;
  // How much is charged online now vs owed at the venue, by chosen option.
  const amountDueNow = paymentOption === 'pay_at_venue' ? 0
    : paymentOption === 'deposit' ? Math.round(grandTotal * (depositPercent / 100) * 100) / 100
    : grandTotal;
  const balanceDue = Math.round((grandTotal - amountDueNow) * 100) / 100;

  // Live availability for the chosen court (or the venue pool when none) on this
  // date → greys out hours that court is already taken. `ready` gates the Step-0
  // Continue so a slot is never waved through while the check is still loading (it
  // otherwise reads as free — fail closed); `checkFailed` lets us fall back to
  // server enforcement rather than trapping the user behind our own outage;
  // `reloadAvailability` re-checks after a server-side slot conflict.
  const { availability, ready, checkFailed, minBookableHour, endDisabledFor, rangeBlocked, firstFreeHour, isPast, isFull, reload: reloadAvailability } = useVenueAvailability(selected?.id, date, courtId || undefined);
  const slotUnavailable = rangeBlocked(startTime, endTime);
  const startInPast = Number(startTime.split(':')[0]) < minBookableHour;
  // A venue+date is chosen but availability hasn't resolved (and didn't error): the
  // greying can't be trusted yet, so hold the user on Step 0 (fail closed).
  const availabilityPending = !!selected?.id && !!date && !ready && !checkFailed;

  // Per-hour classification for the Start picker: hide past hours, but keep booked
  // ones visible-and-greyed with a "Booked" tag so it's clear *why* they're gone.
  // Also hide hours outside the venue's operating window for the selected date.
  const operatingWindow = useMemo(() => {
    const dow = new Date(date + 'T00:00:00').getDay();
    const dayEntries = venueHours.filter((h) => h.dayOfWeek === dow);

    // Start from the VenueHour operating window for this day.
    let open = 0;
    let close = 24;
    let hasExplicitHours = false;

    if (dayEntries.length > 0) {
      hasExplicitHours = true;
      // If ALL entries are closed/zero-width, start with everything hidden.
      if (dayEntries.every((h) => h.isClosed || h.openTime === h.closeTime)) {
        open = 0; close = 0;
      } else {
        const candidates = dayEntries.filter((h) => !h.isClosed && h.openTime !== h.closeTime);
        const courtScoped = candidates.filter((h) => h.courtId != null);
        const relevant = courtScoped.length > 0 ? courtScoped : candidates;
        if (relevant.length > 0) {
          open = 24; close = 0;
          for (const h of relevant) {
            const o = Number((h.openTime ?? '00:00').split(':')[0]);
            const c = Number((h.closeTime ?? '24:00').split(':')[0]);
            if (o < open) open = o;
            if (c > close) close = c;
          }
          if (close <= open) { open = 0; close = 0; }
        }
      }
    }

    // Expand the window to include any slot price overrides for this date —
    // an override like "early bird 08:00–10:00" means those hours ARE bookable.
    if (overrides.length > 0) {
      for (const o of overrides) {
        const oH = Number((o.startTime ?? '00:00').split(':')[0]);
        const cH = Number((o.endTime ?? '00:00').split(':')[0]);
        if (cH <= oH) continue;
        if (hasExplicitHours && open === 0 && close === 0) {
          // Venue is explicitly closed, but override says otherwise — open up.
          open = oH; close = cH;
        } else {
          if (oH < open) open = oH;
          if (cH > close) close = cH;
        }
      }
    }

    if (close <= open) return { open: 0, close: 0 };
    return { open, close };
  }, [venueHours, overrides, date]);

  const startHourInfo = (h: number): { hide?: boolean; disabled?: boolean; note?: string } => {
    if (h < operatingWindow.open || h >= operatingWindow.close) return { hide: true };
    if (isPast(h)) return { hide: true };
    if (isFull(h)) return { disabled: true, note: 'Booked' };
    return {};
  };

  // End-time filtering: hide hours before the start time, outside operating hours,
  // and hours that would cause a booking conflict.
  const endHourInfo = (h: number): { hide?: boolean; disabled?: boolean; note?: string } => {
    if (h < operatingWindow.open || h > operatingWindow.close) return { hide: true };
    if (endDisabledFor(startTime)(h)) return { disabled: true, note: 'Unavailable' };
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
  const [prevFullKey, setPrevFullKey] = useState(`${selected?.id ?? ''}|${courtId}|${calMonth?.y ?? ''}|${calMonth?.m ?? ''}`);
  const fullKey = `${selected?.id ?? ''}|${courtId}|${calMonth?.y ?? ''}|${calMonth?.m ?? ''}`;
  if (fullKey !== prevFullKey) {
    setPrevFullKey(fullKey);
    setFullDays(new Set());
  }
  useEffect(() => {
    if (!selected?.id || !calMonth) return;
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
  // A date switch instead re-anchors the start to the new day's EARLIEST free
  // hour (not just off an invalid one). `anchoredDate` records which date the
  // start time was picked for; availability nulls out while a new date's check
  // is in flight, so the anchor only advances when the new data actually lands.
  const [anchoredDate, setAnchoredDate] = useState(date);
  const prevAvailabilityRef = useRef(availability);
  if (availability !== prevAvailabilityRef.current) {
    prevAvailabilityRef.current = availability;
    const cur = Number(startTime.split(':')[0]);
    let target: number | null;
    if (date !== anchoredDate) {
      target = availability ? firstFreeHour(0) : null;
      if (availability) setAnchoredDate(date);
    } else {
      target = firstFreeHour(cur) ?? (cur < minBookableHour && minBookableHour <= 23 ? minBookableHour : null);
    }
    if (target != null && target !== cur) { setStartTime(`${String(target).padStart(2, '0')}:00`); setEndTime(''); }
  }

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

  // Both modes carry a "details" step (index 1): a hosted game collects
  // format + slots; an open play session collects session details — or flips
  // to a plain private reservation via its open/private toggle.
  // 0=court, 1=details, 2=summary, 3=checkout.
  const totalSteps = 4;
  const stepTitles = bookingMode === 'open_play'
    ? ['Court & time', opPrivate ? 'Private game details' : 'Open play details', 'Summary', 'Checkout']
    : ['Court & time', 'Game details', 'Summary', 'Checkout'];

  const summaryStep = 2;
  const checkoutStep = 3;
  const back = () => {
    if (step > 0) {
      // Demand signal: user left checkout without completing.
      if (step === checkoutStep && selected) {
        trackCheckoutAbandoned(selected.id, courtId || undefined, date, startTime);
      }
      setError(null);
      setStep((s) => s - 1);
    } else {
      // Demand signal: user abandoned the booking flow entirely.
      if (selected) {
        trackCheckoutAbandoned(selected.id, courtId || undefined, date, startTime);
      }
      onBack();
    }
  };

  const payAtVenue = paymentOption === 'pay_at_venue';

  const chooseBookingMode = (mode: BookingMode) => {
    setBookingMode(mode);
  };

  /** Create the open-play game on a confirmed booking (best-effort — a failure
   *  leaves the booking intact and the host can create the game from My Bookings). */
  const createOpenPlayGame = async (bookingId: string) => {
    try {
      const game = await createGame({
        title: opName.trim() || undefined,
        description: opDesc.trim() || undefined,
        venueId: selected?.id,
        gameType: 'open',
        vibe: gameVibe,
        skillLabel: opSkill,
        targetPlayers: opTarget,
        timeLabel: to12h(startTime),
        durationLabel: hours > 0 ? `${hours} hr` : undefined,
        date,
        visibility: 'public',
        bookingId,
      });
      return game;
    } catch {
      // Booking succeeded — the game is a nice-to-have; don't block on failure.
      return null;
    }
  };

  /** Create the public game (format + capped roster) on a confirmed booking.
   *  Best-effort, same as open play. */
  const createPublicGame = async (bookingId: string) => {
    try {
      const game = await createGame({
        title: opName.trim() || undefined,
        description: opDesc.trim() || undefined,
        venueId: selected?.id,
        gameType: 'public',
        format: pgFormat ?? undefined,
        vibe: gameVibe,
        capacity: pgSlots,
        skillLabel: pgSkill,
        timeLabel: to12h(startTime),
        durationLabel: hours > 0 ? `${hours} hr` : undefined,
        date,
        visibility: 'public',
        bookingId,
      });
      return game;
    } catch {
      return null;
    }
  };

  /** Create the game that goes with a confirmed booking, per booking mode
   *  (hosted game → format game; open play → interest game, unless the host
   *  flipped the session private — a private game publishes nothing). */
  const createGameForMode = (bookingId: string) =>
    bookingMode === 'public_game' ? createPublicGame(bookingId)
      : opPrivate ? Promise.resolve(null)
      : createOpenPlayGame(bookingId);

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
    trackBookingAttempt(selected.id, courtId || undefined, date, startTime);
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
        trackBookingCompleted(selected.id, courtId || undefined);
        return;
      }
      // Pay-at-venue: the booking is already confirmed at creation and nothing is
      // charged online, so skip checkout entirely.
      if (payAtVenue) {
        const game = await createGameForMode(booking.id);
        setDone({ confirmed: true, bookingId: booking.id, gameId: game?.id ?? null });
        trackBookingCompleted(selected.id, courtId || undefined);
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
      let gameId: string | null = null;
      if (confirmed) {
        const game = await createGameForMode(bookingId);
        gameId = game?.id ?? null;
      }
      setDone({ confirmed, bookingId, gameId });
      trackBookingCompleted(selected.id, courtId || undefined);
    } catch (e) {
      // Map known server error codes to friendly copy; a slot/price change bounces
      // the user back to Step 0 and re-checks availability so the taken hour greys.
      const mapped = mapBookingError(e);
      setError(mapped.message);
      if (mapped.backToStep0) { setStep(0); reloadAvailability(); }
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
      // Don't advance while the availability check is still loading — it reads as
      // "free" until then, so we'd wave a possibly-taken slot through (fail closed).
      if (availabilityPending) { setError('Checking availability — one moment…'); return; }
      if (slotUnavailable) { setError('That time is fully booked. Please pick a free slot.'); return; }
    }
    // Public game requires a format before leaving the details step.
    if (bookingMode === 'public_game' && step === 1 && !pgFormat) {
      setError('Pick a format for your game.');
      return;
    }
    setError(null);
    if (step < totalSteps - 1) {
      // Demand signal: user reached the checkout step.
      if (step === checkoutStep - 1 && selected) {
        trackCheckoutStarted(selected.id, courtId || undefined, date, startTime);
      }
      setStep((s) => s + 1);
    } else void submit();
  };

  // Join the waitlist for a fully-booked slot.
  const joinWaitlistForSlot = async () => {
    if (!selected || !date || !startTime || !endTime) return;
    setJoiningWaitlist(true);
    setError(null);
    try {
      await joinWaitlist({
        venueId: selected.id,
        courtId: courtId || undefined,
        date,
        startTime,
        endTime,
        playerCount: 1,
      });
      setWaitlistJoined(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not join waitlist.';
      if (/already|duplicate/i.test(msg)) setError('You\'re already on the waitlist for this slot.');
      else if (/book it directly/i.test(msg)) setError('A court opened up — you can book it directly now.');
      else setError(msg);
    } finally {
      setJoiningWaitlist(false);
    }
  };

  if (done) {
    // Open play + public game create their game inline during the booking flow, so
    // the confirmation offers to view the live game (interest board / lobby).
    const isPublic = bookingMode === 'public_game';
    const gameDone = done.confirmed && !!done.gameId;
    const viewGameAction = gameDone
      ? [{
          label: isPublic ? 'View your game' : 'View open play',
          variant: 'dark' as const,
          onClick: () => (isPublic
            ? onNavigate('game-details', { id: done.gameId! }, { replace: true })
            : onNavigate('open-play-detail', { source: 'game', id: done.gameId! }, { replace: true })),
        }]
      : [];
    return (
      <CompletionScreen
        icon={done.confirmed ? 'check' : 'clock'}
        title={
          gameDone ? (isPublic ? 'Game created!' : 'Open play created!')
            : done.confirmed ? 'Booking confirmed!'
            : 'Booking requested'
        }
        description={
          gameDone
            ? (isPublic
              ? 'Your court is booked and your game is live. Players can join up to your slot cap.'
              : 'Your court is booked and your open play is live. Players can show interest now.')
            : done.confirmed
            ? 'Your court is booked. You can see it under My bookings.'
            : 'Your request was sent and is awaiting venue approval.'
        }
        actions={[
          ...viewGameAction,
          // `replace` drops the finished wizard from the back stack so Back from
          // My bookings doesn't re-open it at step 1.
          { label: 'View my bookings', variant: gameDone ? ('outline' as const) : ('dark' as const), onClick: () => onNavigate('my-bookings', undefined, { replace: true }) },
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
        title={stepTitles[step]}
      />

      <div className="px-5 pb-4">
        <ProgressBar value={(step + 1) / totalSteps} />
      </div>

      {/* ─── Step 0: court & schedule ─────────────────────────── */}
      {step === 0 && (
        <>
          <div className="field">
            <div className="lbl">Booking type</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BOOKING_MODE_OPTIONS.map((opt) => {
                const active = bookingMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => chooseBookingMode(opt.value)}
                    aria-pressed={active}
                    className={`min-h-[104px] rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                      active
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                        : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-[var(--surface-2)] text-[var(--ink)]'}`}>
                        <Icon name={opt.icon} size={16} />
                      </span>
                      {active && <Icon name="check" size={16} />}
                    </div>
                    <div className="font-heading text-[14px] font-bold leading-tight">{opt.label}</div>
                    <div className={`mt-1 text-[11px] font-semibold leading-snug ${active ? 'text-white/75' : 'text-[var(--muted)]'}`}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <div className="flex items-center justify-between mb-2">
              <div className="lbl mb-0!">Venue</div>
              {selected && !picking && (
                <button type="button" className="chip" onClick={() => setPicking(true)}>
                  <Icon name="edit" size={12} /> Change
                </button>
              )}
            </div>

            {selected && !picking ? (
              <SelectedVenueCard venue={selected} currency={currency} />
            ) : !picking ? (
              /* Deep-linked venue whose detail is still loading (picker not shown). */
              <LoadingSkeleton variant="card" count={1} />
            ) : directoryLoading ? (
              <LoadingSkeleton variant="card" count={3} />
            ) : venues.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold py-2">
                No bookable courts right now — only venues with published rates can be booked.
              </div>
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
                  <Chip key={`${selectedCourt.id}-half-${i}`} selected={subUnitIndex === i} onClick={() => setSubUnitIndex(i)}>
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
                <HourSelect aria-label="End time" placeholder="Set end" value={endTime} after={startTime} onChange={setEndTime} hourInfo={endHourInfo} />
              </div>
            </div>
            {slotUnavailable && (
              <div className="mt-2">
                <div className="t-sm text-[var(--coral)] font-bold">That time is fully booked — pick a free slot.</div>
                {waitlistJoined ? (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-[var(--lime)]/15 text-[var(--lime-ink)] text-[12px] font-semibold flex items-center gap-1.5">
                    <Icon name="check" size={14} /> You're on the waitlist — we'll notify you if a spot opens up.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={joinWaitlistForSlot}
                    disabled={joiningWaitlist || !selected || !date || !startTime || !endTime}
                    className="mt-2 w-full h-10 rounded-xl border-[1.5px] border-[var(--coral)] text-[var(--coral)] font-heading font-bold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {joiningWaitlist
                      ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> Joining waitlist…</>
                      : <><Icon name="queue" size={14} /> Join waitlist — get notified if a court opens</>}
                  </button>
                )}
              </div>
            )}
            {/* V3: open-play passive note. */}
            {selected?.openPlayPrice != null && Number(selected.openPlayPrice) > 0 && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[12px] font-semibold text-[var(--muted)]">
                <Icon name="groups" size={14} className="inline mr-1 align-text-bottom" />
                Open play venue rate: {money(Number(selected.openPlayPrice), currency)}/player/session.
              </div>
            )}
          </div>

          {selected && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                {hours > 0 ? (
                  hourlyBreakdown.length > 1 || equipAmount > 0 || surcharge > 0 ? (
                    /* ── Blended rates or add-ons: line-item breakdown ── */
                    <div className="flex flex-col gap-1.5">
                      {hourlyBreakdown.map((g, i) => {
                        const segHrs = g.endHour - g.startHour;
                        const segStart = `${String(g.startHour).padStart(2, '0')}:00`;
                        const segEnd = `${String(g.endHour).padStart(2, '0')}:00`;
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <div className="text-[12px] font-semibold text-[var(--muted)]">
                              {to12h(segStart)} – {to12h(segEnd)}
                              <span className="opacity-70"> · {money(g.rate, currency)}/hr × {segHrs} hr</span>
                            </div>
                            <div className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">
                              {money(g.rate * segHrs, currency)}
                            </div>
                          </div>
                        );
                      })}
                      {equipAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] font-semibold text-[var(--muted)]">Equipment rental</div>
                          <div className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">{money(equipAmount, currency)}</div>
                        </div>
                      )}
                      {surcharge > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] font-semibold text-[var(--muted)]">
                            Extra players ({Math.max(0, playerCount - (Number(selected?.perPlayerFeeThreshold) || 1))} × {money(Number(selected?.perPlayerFee) || 0, currency)})
                          </div>
                          <div className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">{money(surcharge, currency)}</div>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t-[0.5px] border-[var(--hairline)]">
                        <div className="text-[13px] font-bold text-[var(--ink)]">Total</div>
                        <div className="font-heading font-bold text-[22px] text-[var(--ink)] tabular-nums">{money(subtotal, currency)}</div>
                      </div>
                    </div>
                  ) : (
                    /* ── Single rate, no add-ons: compact one-liner ── */
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-[var(--muted)]">
                        {money(rate, currency)}/hr × {hours} hr
                      </div>
                      <div className="font-heading font-bold text-[22px] text-[var(--ink)]">{money(subtotal, currency)}</div>
                    </div>
                  )
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

      {/* ─── Step 1 (open play): open/private toggle + game details ── */}
      {bookingMode === 'open_play' && step === 1 && (
        <>
          <div className="field">
            <div className="lbl">Who can join</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`time-pick ${!opPrivate ? 'active' : ''}`} onClick={() => setOpPrivate(false)}>🌐 Open play</button>
              <button type="button" className={`time-pick ${opPrivate ? 'active' : ''}`} onClick={() => setOpPrivate(true)}>🔒 Private game</button>
            </div>
          </div>

          {opPrivate ? (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] px-4 py-3.5 text-[13px] font-semibold text-[var(--muted)]">
                The court is reserved for your own group — nothing is published and other players can't join.
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <div className="lbl">Skill level</div>
              </div>
              <div className="time-grid">
                {SKILLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`time-pick ${opSkill === s ? 'active' : ''}`}
                    onClick={() => setOpSkill(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="field mt-4">
                <div className="lbl">Vibe</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={`time-pick ${gameVibe === 'casual' ? 'active' : ''}`} onClick={() => setGameVibe('casual')}>😎 Casual</button>
                  <button type="button" className={`time-pick ${gameVibe === 'competitive' ? 'active' : ''}`} onClick={() => setGameVibe('competitive')}>🔥 Competitive</button>
                </div>
              </div>

              <div className="field">
                <div className="lbl">Aiming for · {opTarget} players</div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                    <button type="button" aria-label="Lower target" onClick={() => setOpTarget((n) => Math.max(2, n - 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)] disabled:opacity-40" disabled={opTarget <= 2}>
                      <Icon name="minus" size={18} />
                    </button>
                    <div className="w-12 text-center font-heading font-bold text-[17px] text-[var(--ink)] tabular-nums">{opTarget}</div>
                    <button type="button" aria-label="Raise target" onClick={() => setOpTarget((n) => Math.min(64, n + 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)] disabled:opacity-40" disabled={opTarget >= 64}>
                      <Icon name="plus" size={18} />
                    </button>
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--muted)]">A goal, not a cap — anyone can still show interest.</div>
                </div>
              </div>

              <div className="field mt-4">
                <div className="lbl">Game name (optional)</div>
                <input
                  className="control"
                  placeholder="e.g. Friday Night Dinks"
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="field">
                <div className="lbl">Description (optional)</div>
                <textarea
                  className="control"
                  placeholder="Tell players what to expect — rules, vibe, what to bring…"
                  value={opDesc}
                  onChange={(e) => setOpDesc(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <div className="text-[11px] font-semibold text-[var(--muted)] mt-1 text-right">{opDesc.length} / 500</div>
              </div>
            </>
          )}

          {/* Summary card: court + time recap so the host sees what they're publishing on. */}
          {selected && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Court</div>
                  <div className="text-right min-w-0">
                    <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{selected.displayName}</div>
                    {locationLine(selected) && <div className="text-[11px] font-semibold text-[var(--muted)]">{locationLine(selected)}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Date</div>
                  <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">{prettyDate(date)}</div>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Time</div>
                  <div className="text-right">
                    <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">{to12h(startTime)} – {to12h(endTime)}</div>
                    {hours > 0 && <div className="text-[11px] font-semibold text-[var(--muted)]">{hours} hr</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Step 1 (public game): format + slots + details ─────── */}
      {bookingMode === 'public_game' && step === 1 && (
        <>
          <div className="field">
            <div className="lbl">Game format</div>
            <div className="time-grid">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  className={`time-pick ${pgFormat === f.v ? 'active' : ''}`}
                  onClick={() => setPgFormat(f.v)}
                >
                  <span className="mr-1">{f.icon}</span>{f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Player slots · {pgSlots}</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                <button type="button" aria-label="Fewer slots" onClick={() => setPgSlots((n) => Math.max(MIN_SLOTS, n - 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)] disabled:opacity-40" disabled={pgSlots <= MIN_SLOTS}>
                  <Icon name="minus" size={18} />
                </button>
                <div className="w-12 text-center font-heading font-bold text-[17px] text-[var(--ink)] tabular-nums">{pgSlots}</div>
                <button type="button" aria-label="More slots" onClick={() => setPgSlots((n) => Math.min(MAX_SLOTS, n + 1))} className="w-11 h-11 flex items-center justify-center text-[var(--ink)] disabled:opacity-40" disabled={pgSlots >= MAX_SLOTS}>
                  <Icon name="plus" size={18} />
                </button>
              </div>
              <div className="text-[12px] font-semibold text-[var(--muted)]">Only {pgSlots} players can join (you count as one).</div>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Skill level</div>
            <div className="time-grid">
              {SKILLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`time-pick ${pgSkill === s ? 'active' : ''}`}
                  onClick={() => setPgSkill(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Vibe</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`time-pick ${gameVibe === 'casual' ? 'active' : ''}`} onClick={() => setGameVibe('casual')}>😎 Casual</button>
              <button type="button" className={`time-pick ${gameVibe === 'competitive' ? 'active' : ''}`} onClick={() => setGameVibe('competitive')}>🔥 Competitive</button>
            </div>
          </div>

          <div className="field mt-4">
            <div className="lbl">Game name (optional)</div>
            <input
              className="control"
              placeholder="e.g. Saturday Night Bracket"
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="field">
            <div className="lbl">Description (optional)</div>
            <textarea
              className="control"
              placeholder="Tell players what to expect — rules, vibe, what to bring…"
              value={opDesc}
              onChange={(e) => setOpDesc(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="text-[11px] font-semibold text-[var(--muted)] mt-1 text-right">{opDesc.length} / 500</div>
          </div>

          {/* Summary card: court + time recap so the host sees what they're publishing on. */}
          {selected && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Court</div>
                  <div className="text-right min-w-0">
                    <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{selected.displayName}</div>
                    {locationLine(selected) && <div className="text-[11px] font-semibold text-[var(--muted)]">{locationLine(selected)}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Date</div>
                  <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">{prettyDate(date)}</div>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Time</div>
                  <div className="text-right">
                    <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">{to12h(startTime)} – {to12h(endTime)}</div>
                    {hours > 0 && <div className="text-[11px] font-semibold text-[var(--muted)]">{hours} hr</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Step {summaryStep === 1 ? '1' : '2'}: review ──────────────────────── */}
      {step === summaryStep && selected && (
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

        {/* Open-play game recap — shown on the summary step so the host can
            review (a private session publishes nothing, so there's no recap). */}
        {bookingMode === 'open_play' && !opPrivate && (
          <div className="field">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
              <ReviewRow label="Skill level" value={opSkill} />
              <ReviewRow label="Vibe" value={gameVibe === 'casual' ? 'Casual' : 'Competitive'} />
              <ReviewRow label="Aiming for" value={`${opTarget} players`} />
              {opName.trim() && <ReviewRow label="Name" value={opName.trim()} />}
              {opDesc.trim() && (
                <div className="px-4 py-3.5 border-t-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1">Description</div>
                  <div className="text-[13px] font-semibold text-[var(--ink)] whitespace-pre-wrap">{opDesc.trim()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Public-game recap — format + slots + optional name/desc. */}
        {bookingMode === 'public_game' && (
          <div className="field">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
              <ReviewRow label="Format" value={FORMAT_OPTIONS.find((f) => f.v === pgFormat)?.label ?? '—'} />
              <ReviewRow label="Player slots" value={String(pgSlots)} />
              <ReviewRow label="Skill level" value={pgSkill} />
              <ReviewRow label="Vibe" value={gameVibe === 'casual' ? 'Casual' : 'Competitive'} />
              {opName.trim() && <ReviewRow label="Name" value={opName.trim()} />}
              {opDesc.trim() && (
                <div className="px-4 py-3.5 border-t-[0.5px] border-[var(--hairline)]">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1">Description</div>
                  <div className="text-[13px] font-semibold text-[var(--ink)] whitespace-pre-wrap">{opDesc.trim()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="field">
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
            <ReviewRow label="Court" value={selected.displayName} sub={locationLine(selected) || undefined} />
            {subUnitIndex != null && <ReviewRow label="Unit" value={`Half ${subUnitIndex + 1}`} />}
            <ReviewRow label="Date" value={prettyDate(date)} />
            <ReviewRow label="Time" value={`${to12h(startTime)} – ${to12h(endTime)}`} sub={`${hours} hr`} />
            {hourlyBreakdown.length > 1 ? (
              /* ── Blended rates: per-block breakdown ── */
              <div className="px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
                <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Rate</div>
                <div className="flex flex-col gap-1">
                  {hourlyBreakdown.map((g, i) => {
                    const segHrs = g.endHour - g.startHour;
                    const segStart = `${String(g.startHour).padStart(2, '0')}:00`;
                    const segEnd = `${String(g.endHour).padStart(2, '0')}:00`;
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="text-[12px] font-semibold text-[var(--muted)]">
                          {to12h(segStart)} – {to12h(segEnd)}
                          <span className="opacity-70"> · {money(g.rate, currency)}/hr × {segHrs} hr</span>
                        </div>
                        <div className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">
                          {money(g.rate * segHrs, currency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <ReviewRow
                label="Rate"
                value={`${money(rate, currency)}/hr`}
                sub={[
                  rateInfo.source === 'surge' ? 'Adjusted rate' : rateInfo.source === 'holiday' ? 'Holiday rate' : rateInfo.source === 'weekend' ? 'Weekend rate' : rateInfo.source === 'timeBlock' ? 'Time-block rate' : rateInfo.source === 'subUnit' ? 'Sub-unit rate' : null,
                  rateInfo.memberApplied ? `Member −${rateInfo.memberDiscountPercent}%` : null,
                ].filter(Boolean).join(' · ') || undefined}
              />
            )}
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

      {/* ─── Step {checkoutStep}: checkout ──────────────────────── */}
      {step === checkoutStep && selected && (
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
        <Button fullWidth onClick={next} disabled={submitting || !selected || (step === 0 && availabilityPending)}>
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
          ) : step === 0 && availabilityPending ? (
            <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Checking availability…</>
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
