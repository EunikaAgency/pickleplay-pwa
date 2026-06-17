import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CourtPicker } from '../../shared/components/ui/CourtPicker';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import type { Navigate } from '../../shared/lib/navigation';
import {
  listAllVenues, createBooking, checkout, getSettings, listCourts,
  type ApiVenue, type ApiCourt, type AppSettings, type CheckoutCard,
} from '../../shared/lib/api';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import { locationLine, priceLabel, venueImage } from '../../shared/lib/venueDisplay';
import { addHours, hoursBetween, money, prettyDate, snapToHour, to12h, to24h, todayYMD } from './bookingDisplay';

interface BookCourtScreenProps {
  venueId?: string;
  /** Schedule prefill (date / 12h time label / hours). */
  date?: string;
  time?: string;            // 12h label like "6:30 PM"
  hours?: number;
  onNavigate: Navigate;
  onBack: () => void;
}

const TITLE_BY_STEP = ['Court & time', 'Summary', 'Checkout'];

/** A venue is bookable only if it has a rate (decision: require a price). */
function isBookable(v: ApiVenue): boolean {
  return v.priceFrom != null;
}

export function BookCourtScreen({ venueId, date: dateProp, time: timeProp, onNavigate, onBack }: BookCourtScreenProps) {
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
  const rate = selected?.priceFrom ?? 0;
  const hours = hoursBetween(startTime, endTime);
  const total = Math.round(rate * hours * 100) / 100;
  const isTest = settings?.paymentTestMode ?? false;

  // Live availability for the chosen court (or the venue pool when none) on this
  // date → greys out hours that court is already taken.
  const { availability, minBookableHour, startDisabled, endDisabledFor, rangeBlocked, firstFreeHour } = useVenueAvailability(selected?.id, date, courtId || undefined);
  const slotUnavailable = rangeBlocked(startTime, endTime);
  const startInPast = Number(startTime.split(':')[0]) < minBookableHour;

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
  const back = () => (step > 0 ? (setError(null), setStep((s) => s - 1)) : onBack());

  const submit = async () => {
    if (!selected) { setError('Please choose a court.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking({
        venueId: selected.id,
        courtId: courtId || undefined,
        date,
        startTime,
        endTime,
        amount: total,
      });
      const result = await checkout({
        bookingId: booking.id,
        amount: total,
        currency,
        method: isTest ? 'test_card' : 'card',
        card,
      });
      const confirmed = result.booking?.status === 'confirmed';
      const bookingId = result.booking?.id ?? booking.id;
      setDone({ confirmed, bookingId });
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
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else void submit();
  };

  if (done) {
    return (
      <CompletionScreen
        icon={done.confirmed ? 'check' : 'clock'}
        title={done.confirmed ? 'Booking confirmed!' : 'Booking requested'}
        description={
          done.confirmed
            ? 'Your court is booked. You can see it under My bookings.'
            : 'Your request was sent and is awaiting venue approval.'
        }
        actions={[
          // `replace` drops the finished wizard from the back stack so Back from
          // My bookings doesn't re-open it at step 1.
          { label: 'View my bookings', variant: 'dark' as const, onClick: () => onNavigate('my-bookings', undefined, { replace: true }) },
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
            <CalendarDatePicker value={date} min={todayYMD()} onChange={setDate} />
          </div>

          {courts.length > 0 && (
            <div className="field">
              <div className="lbl">Court</div>
              <CourtPicker courts={courts} value={courtId} onChange={setCourtId} />
            </div>
          )}

          <div className="field">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="lbl">Start time</div>
                <HourSelect aria-label="Start time" value={startTime} onChange={onStartChange} disabled={startDisabled} />
              </div>
              <div>
                <div className="lbl">End time</div>
                <HourSelect aria-label="End time" placeholder="Set end" value={endTime} after={startTime} onChange={setEndTime} disabled={endDisabledFor(startTime)} />
              </div>
            </div>
            {slotUnavailable && (
              <div className="mt-2 t-sm text-[var(--coral)] font-bold">That time is fully booked — pick a free slot.</div>
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
                    <div className="font-heading font-bold text-[22px] text-[var(--ink)]">{money(total, currency)}</div>
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
        <div className="field">
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
            <ReviewRow label="Court" value={selected.displayName} sub={locationLine(selected) || undefined} />
            <ReviewRow label="Date" value={prettyDate(date)} />
            <ReviewRow label="Time" value={`${to12h(startTime)} – ${to12h(endTime)}`} sub={`${hours} hr`} />
            <ReviewRow label="Rate" value={`${money(rate, currency)}/hr`} />
            <div className="flex items-center justify-between px-4 py-4 bg-[var(--ink)] text-white">
              <div className="font-heading font-semibold text-[15px]">Total</div>
              <div className="font-heading font-bold text-[22px]">{money(total, currency)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 2: checkout ─────────────────────────────────── */}
      {step === 2 && selected && (
        <>
          {isTest && (
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
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 flex items-center justify-between mb-4">
              <div className="min-w-0">
                <div className="font-heading font-semibold text-[14px] truncate">{selected.displayName}</div>
                <div className="text-[11px] opacity-70 font-semibold">{prettyDate(date)} · {to12h(startTime)} · {hours} hr</div>
              </div>
              <div className="font-heading font-bold text-[18px] text-[var(--ink)]">{money(total, currency)}</div>
            </div>

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
          </div>
        </>
      )}

      <div className="app-action-bar">
        {error && <div className="text-[13px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>}
        <Button fullWidth onClick={next} disabled={submitting || venuesLoading || venues.length === 0}>
          {step === totalSteps - 1 ? (
            submitting ? (
              <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Processing…</>
            ) : (
              <><Icon name="lock" size={16} /> Pay {money(total, currency)}</>
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
