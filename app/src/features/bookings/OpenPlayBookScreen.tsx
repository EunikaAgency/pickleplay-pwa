import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import {
  getVenue, createBooking, checkout, getSettings,
  type ApiVenueDetail, type AppSettings, type CheckoutCard,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { money, prettyDate, snapToHour, to12h, todayYMD } from './bookingDisplay';

interface OpenPlayBookScreenProps {
  venueId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * V3 — open-play booking (Phase 1). A courtless, per-session drop-in: pick a date
 * + start time + party size and pay the venue's flat open-play fee (× party).
 * Test mode confirms instantly; launch live mode waits for manual GCash
 * confirmation. Reuses
 * the same createBooking → checkout path as the court flow; the booking lands in
 * My Bookings tagged "Open play". Gated by `player.bookings.create` in App.tsx.
 */
export function OpenPlayBookScreen({ venueId, onNavigate, onBack }: OpenPlayBookScreenProps) {
  const [venue, setVenue] = useState<ApiVenueDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading');

  const [date, setDate] = useState(todayYMD());
  const [startTime, setStartTime] = useState(snapToHour('18:00'));
  const [party, setParty] = useState(1);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ confirmed: boolean } | null>(null);

  useEffect(() => {
    // loadState starts 'loading'; the screen is keyed by venueId (remounts per
    // venue), so this effect runs once per mount — no need to reset it here.
    let alive = true;
    getVenue(venueId)
      .then((v) => { if (alive) { setVenue(v); setLoadState('idle'); } })
      .catch(() => { if (alive) setLoadState('error'); });
    return () => { alive = false; };
  }, [venueId]);

  // Payment mode (pre-fills the demo card in test mode, like the court flow).
  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => { if (!alive) return; setSettings(s); if (s.paymentTestMode) setCard({ ...s.testCard }); })
      .catch(() => { /* default to the live card form */ });
    return () => { alive = false; };
  }, []);

  const isTest = settings?.paymentTestMode ?? false;
  const currency = venue?.pricingCurrency ?? 'PHP';
  const sessionFee = Number(venue?.openPlayPrice) || 0;
  const total = sessionFee * party;
  const offersOpenPlay = sessionFee > 0;

  // Today's past hours can't be booked — hide them (mirrors the court flow).
  const todayHour = useMemo(() => new Date().getHours(), []);
  const hideHour = (h: number) => date === todayYMD() && h <= todayHour;

  const submit = async () => {
    if (!venue || !offersOpenPlay) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking({
        venueId: venue.id,
        bookingType: 'open_play',
        date,
        startTime,
        playerCount: party,
        amount: total,
      });
      const result = await checkout({
        bookingId: booking.id,
        amount: total,
        currency,
        method: isTest ? 'test_card' : 'gcash',
        card: isTest ? card : undefined,
      });
      setDone({ confirmed: result.booking?.status === 'confirmed' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete your open-play booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Open play"
      title="Join open play"
      subtitle={venue ? venue.displayName : 'Drop-in session'}
      className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]"
    />
  );

  if (done) {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <CompletionScreen
          icon={done.confirmed ? 'check_circle' : 'schedule'}
          title={done.confirmed ? "You're in for open play!" : 'Open play requested'}
          description={done.confirmed
            ? `${prettyDate(date)} at ${to12h(startTime)} · ${party} player${party === 1 ? '' : 's'} · ${money(total, currency)}`
            : 'Your open-play booking is held while the venue confirms your GCash payment.'}
          actions={[
            { label: 'View my bookings', onClick: () => onNavigate('my-bookings') },
            { label: 'Back to venue', variant: 'outline', onClick: onBack },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom px-5">
      {header}

      {loadState === 'loading' ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : loadState === 'error' || !venue ? (
        <div className="t-sm text-[var(--coral)] font-bold text-center mt-8">Couldn't load this venue. Go back and try again.</div>
      ) : !offersOpenPlay ? (
        <div className="card p-4 mt-4 text-center">
          <div className="hd-3 mb-1">Open play isn't offered here</div>
          <p className="t-sm">This venue hasn't set an open-play session fee. Try booking a court instead.</p>
          <Button variant="outline" className="mt-3" onClick={onBack}>Back</Button>
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="lbl">Session fee</div>
                <div className="hd-2">{money(sessionFee, currency)}<span className="t-sm font-semibold"> / player</span></div>
              </div>
              <Icon name="sports_tennis" size={28} className="text-[var(--lime-ink)]" />
            </div>
            <p className="t-sm mt-2">Drop-in open play — no court reservation. You pay per player for the session.</p>
          </div>

          <div className="card p-4">
            <div className="lbl mb-2">Date</div>
            <CalendarDatePicker value={date} onChange={setDate} min={todayYMD()} />
          </div>

          <div className="card p-4">
            <div className="lbl mb-2">Start time</div>
            <HourSelect value={startTime} onChange={setStartTime} disabled={hideHour} />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="lbl">Players</div>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Fewer players" className="chip w-9 h-9 justify-center"
                  onClick={() => setParty((p) => Math.max(1, p - 1))} disabled={party <= 1}>
                  <Icon name="remove" size={16} />
                </button>
                <span className="font-heading font-bold text-[18px] w-6 text-center">{party}</span>
                <button type="button" aria-label="More players" className="chip w-9 h-9 justify-center"
                  onClick={() => setParty((p) => Math.min(20, p + 1))} disabled={party >= 20}>
                  <Icon name="add" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="lbl">Payment</div>
              {isTest && <span className="chip text-[12px] font-bold text-[var(--lime-ink)]">TEST mode — no charge</span>}
            </div>
            {isTest ? <>
            <div className="field p-0! mb-2">
              <label className="lbl">Card number</label>
              <input className="control" inputMode="numeric" value={card.number ?? ''} placeholder="4242 4242 4242 4242"
                onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <div className="field p-0! flex-1">
                <label className="lbl">Expiry</label>
                <input className="control" value={card.expiry ?? ''} placeholder="MM/YY"
                  onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} />
              </div>
              <div className="field p-0! flex-1">
                <label className="lbl">CVC</label>
                <input className="control" inputMode="numeric" value={card.cvc ?? ''} placeholder="123"
                  onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))} />
              </div>
            </div>
            </> : (
              <div className="rounded-xl bg-[var(--primary-tint)] px-3 py-3 text-[13px] font-semibold text-[var(--ink-2)]">
                Manual GCash — the booking stays pending until the venue confirms receipt.
              </div>
            )}
          </div>

          {/* Total + pay */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="t-sm font-semibold">{prettyDate(date)} · {to12h(startTime)} · {party} player{party === 1 ? '' : 's'}</div>
              <div className="font-heading font-bold text-[18px]">{money(total, currency)}</div>
            </div>
            {error && <div className="t-sm text-[var(--coral)] font-bold text-center mb-2">{error}</div>}
            <Button fullWidth onClick={submit} disabled={submitting}>
              {submitting ? 'Processing…' : `${isTest ? 'Pay & join' : 'Submit GCash payment'} — ${money(total, currency)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
