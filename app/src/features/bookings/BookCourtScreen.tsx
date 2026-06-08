import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import type { Navigate } from '../../shared/lib/navigation';
import {
  listAllVenues, createBooking, checkout, getSettings, bookGame,
  type ApiVenue, type AppSettings, type CheckoutCard,
} from '../../shared/lib/api';
import { locationLine, priceLabel, venueImage } from '../../shared/lib/venueDisplay';
import { addHours, money, prettyDate, to12h, to24h, todayYMD } from './bookingDisplay';

interface BookCourtScreenProps {
  venueId?: string;
  /** Schedule prefill (e.g. from a game's chosen date/time). */
  date?: string;
  time?: string;            // 12h label like "6:30 PM"
  hours?: number;
  /** When booking for a game lobby: lock the venue + link the booking to the game. */
  gameId?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const DURATIONS = [
  { label: '1 hr', hours: 1 },
  { label: '1.5 hr', hours: 1.5 },
  { label: '2 hr', hours: 2 },
  { label: '3 hr', hours: 3 },
];

const TITLE_BY_STEP = ['Court & time', 'Review', 'Checkout'];

/** A venue is bookable only if it has a rate (decision: require a price). */
function isBookable(v: ApiVenue): boolean {
  return v.priceFrom != null;
}

export function BookCourtScreen({ venueId, date: dateProp, time: timeProp, hours: hoursProp, gameId, onNavigate, onBack }: BookCourtScreenProps) {
  const [step, setStep] = useState(0);
  // Booking for a game locks the venue (it's the voted-on court).
  const lockVenue = !!gameId;

  // Bookable venues (priced only) for the picker.
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(venueId ?? '');
  const [picking, setPicking] = useState(!venueId); // show the list when nothing preselected
  const [query, setQuery] = useState('');

  // Schedule — prefilled from the game's chosen date/time when present.
  const [date, setDate] = useState(dateProp || todayYMD());
  const [startTime, setStartTime] = useState(to24h(timeProp) || '18:00');
  const [hours, setHours] = useState(hoursProp && hoursProp > 0 ? hoursProp : 1.5);

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
  const total = Math.round(rate * hours * 100) / 100;
  const endTime = addHours(startTime, hours);
  const isTest = settings?.paymentTestMode ?? false;

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
      // Booking for a game lobby: attach it so the game flips to booked/paying.
      if (gameId) {
        try { await bookGame(gameId, { bookingId }); } catch { /* booking still valid; lobby resyncs on next load */ }
      }
      setDone({ confirmed, bookingId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step === 0) {
      if (!selected) { setError('Please choose a court.'); return; }
      if (!date) { setError('Please pick a date.'); return; }
      if (!startTime) { setError('Please pick a start time.'); return; }
      if (!(hours > 0)) { setError('Please pick a duration.'); return; }
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
        actions={
          gameId
            ? [
                { label: 'Back to game', variant: 'dark' as const, onClick: () => onNavigate('game-lobby', { id: gameId }) },
                { label: 'My bookings', variant: 'outline' as const, onClick: () => onNavigate('my-bookings') },
              ]
            : [
                { label: 'View my bookings', variant: 'dark' as const, onClick: () => onNavigate('my-bookings') },
                { label: 'Done', variant: 'outline' as const, onClick: onBack },
              ]
        }
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
              <div className="lbl mb-0!">Court</div>
              {selected && !picking && !lockVenue && (
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
            <input
              type="date"
              className="control"
              value={date}
              min={todayYMD()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="lbl">Start time</div>
            <input
              type="time"
              className="control"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="lbl">Duration</div>
            <div className="time-grid">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  className={`time-pick ${hours === d.hours ? 'active' : ''}`}
                  onClick={() => setHours(d.hours)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 flex items-center justify-between">
                <div className="text-[13px] font-semibold text-[var(--muted)]">
                  {money(rate, currency)}/hr × {hours} hr
                </div>
                <div className="font-heading font-bold text-[22px] text-[var(--ink)]">{money(total, currency)}</div>
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
