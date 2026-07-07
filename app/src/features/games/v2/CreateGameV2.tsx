import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { CompletionScreen } from '../../../shared/components/ui/CompletionScreen';
import { getBooking, createGame, type ApiBooking, type CreateGamePayload } from '../../../shared/lib/api';
import { hoursBetween, prettyDate, timeRange, to12h } from '../../bookings/bookingDisplay';

interface Props extends V2ScreenChrome {
  onBack: () => void;
  /** The court reservation this public game is hosted on (chosen in the booking flow). */
  bookingId?: string;
}

type GameFormat = NonNullable<CreateGamePayload['format']>;

const FORMAT_OPTIONS: { v: GameFormat; label: string; icon: string; hint: string }[] = [
  { v: 'bracketing', label: 'Bracketing', icon: '🏆', hint: 'Elimination bracket — win to advance, lose and you’re out.' },
  { v: 'round_robin', label: 'Round-robin', icon: '🔁', hint: 'Everyone plays everyone; most wins takes it.' },
  { v: 'mini_tournament', label: 'Mini-tournament', icon: '🎯', hint: 'A short, multi-round event wrapped up in one session.' },
];

const STEP_TITLES = ['Format', 'Slots', 'Details', 'Review'];
const STEP_COUNT = STEP_TITLES.length;
const MIN_SLOTS = 2;
const MAX_SLOTS = 16;

/**
 * Publish a Public game on a court the player has already booked. Booking and
 * payment happen up front in the Book flow; this 4-step wizard collects the
 * competitive format, the player slot cap, and the details, then calls
 * `createGame({ gameType: 'public' })` — which posts a joinable game with a lobby.
 */
export function CreateGameV2(props: Props) {
  const { onNavigate, onBack, bookingId } = props;

  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [loading, setLoading] = useState(!!bookingId);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<GameFormat | null>(null);
  const [slots, setSlots] = useState(4);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  // Load the booking this game is hosted on (venue/date/time come from it).
  useEffect(() => {
    if (!bookingId) return;
    let alive = true;
    getBooking(bookingId)
      .then((b) => { if (alive) setBooking(b); })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [bookingId]);

  const hours = useMemo(
    () => (booking ? hoursBetween(booking.startTime ?? '', booking.endTime ?? '') : 0),
    [booking],
  );
  const court = booking?.courtName || (booking?.courtNumber ? `Court ${booking.courtNumber}` : '');
  const formatLabel = FORMAT_OPTIONS.find((f) => f.v === format)?.label ?? '';

  const bump = (delta: number) => setSlots((s) => Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, s + delta)));

  const goNext = () => {
    setError(null);
    if (step === 0 && !format) { setError('Pick a format for your game.'); return; }
    if (step < STEP_COUNT - 1) { setStep((s) => s + 1); return; }
    void submit();
  };
  const goBackStep = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  const submit = async () => {
    if (!booking) { setError('Your booked court could not be loaded.'); return; }
    if (!format) { setError('Pick a format for your game.'); setStep(0); return; }
    setSubmitting(true);
    setError(null);
    try {
      const game = await createGame({
        title: name.trim() || undefined,
        description: desc.trim() || undefined,
        venueId: booking.venueId ?? undefined,
        venueName: booking.venueName ?? undefined,
        gameType: 'public',
        format,
        capacity: slots,
        skillLabel: 'All levels',
        timeLabel: booking.startTime ? to12h(booking.startTime) : undefined,
        durationLabel: hours > 0 ? `${hours} hr` : undefined,
        date: booking.date ?? undefined,
        visibility: 'public',
        bookingId: booking.id,
      });
      setDoneId(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish your public game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (doneId) {
    return (
      <CompletionScreen
        icon="check"
        title="Public game published!"
        description={`Your ${formatLabel || 'public'} game is live on your booked court. Up to ${slots} players can join and see the lobby.`}
        actions={[
          { label: 'View public game', variant: 'dark', onClick: () => onNavigate('open-play-detail', { source: 'game', id: doneId }, { replace: true }) },
          { label: 'Done', variant: 'outline', onClick: onBack },
        ]}
      />
    );
  }

  // No reservation to host on (or it failed to load): point the user at the
  // booking flow, which hands back here once a court is reserved.
  if (!bookingId || loadError) {
    return (
      <V2Shell screen="v2-creategame" chrome={props} onBack={onBack} hideFab>
        <div className="page">
          <div className="page-hero" role="banner">
            <div className="page-hero-eyebrow">Games</div>
            <h1>Host a public game</h1>
            <p className="page-hero-sub">Publish a format-driven game from a court you booked.</p>
          </div>
          <div className="form-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎾</div>
            <div className="form-section-label" style={{ justifyContent: 'center' }}>
              {loadError ? 'We couldn’t load that booking' : 'Book a court first'}
            </div>
            <p className="page-hero-sub" style={{ color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              A public game needs a reserved court. Book one first, then publish it for others to join.
            </p>
            <button className="submit-btn" onClick={() => onNavigate('nearby', { intent: 'lobby' })}>
              Find a court to book
            </button>
          </div>
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell screen="v2-creategame" chrome={props} onBack={onBack} hideFab>
      <div className="page">
        <div className="page-hero" role="banner">
          <div className="page-hero-eyebrow">Public game · Step {step + 1} of {STEP_COUNT}</div>
          <h1>{STEP_TITLES[step]}</h1>
          <p className="page-hero-sub">
            {step === 0 && 'How should this game be played?'}
            {step === 1 && 'How many players can join?'}
            {step === 2 && 'Name it and add any details.'}
            {step === 3 && 'Check everything, then publish.'}
          </p>
          <div className="step-row" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEP_COUNT}>
            {STEP_TITLES.map((t, i) => (
              <span key={t} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>
        </div>

        <div className="form-card">
          {/* ── Step 1: Format ── */}
          {step === 0 && (
            <div className="field-group">
              <div className="field-label"><span className="field-label-text">Game format</span></div>
              <div className="type-grid">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    className={`type-option ${format === opt.v ? 'active' : ''}`}
                    aria-pressed={format === opt.v}
                    onClick={() => setFormat(opt.v)}
                  >
                    <span className="type-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
              {format && <p className="vis-help">{FORMAT_OPTIONS.find((f) => f.v === format)?.hint}</p>}
            </div>
          )}

          {/* ── Step 2: Slots ── */}
          {step === 1 && (
            <div className="field-group">
              <div className="field-label">
                <span className="field-label-text">Player slots</span>
                <span className="field-label-hint">{MIN_SLOTS}–{MAX_SLOTS} players</span>
              </div>
              <div className="stepper-wrap">
                <button type="button" className="stepper-btn" onClick={() => bump(-1)} disabled={slots <= MIN_SLOTS} aria-label="Fewer slots">−</button>
                <div className="stepper-value" aria-live="polite">{slots}</div>
                <button type="button" className="stepper-btn" onClick={() => bump(1)} disabled={slots >= MAX_SLOTS} aria-label="More slots">+</button>
              </div>
              <p className="vis-help">Only this many players can join the game. You’re counted as one, so {slots - 1} more can join.</p>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 2 && (
            <>
              <div className="field-group">
                <div className="field-label"><span className="field-label-text">Game name</span></div>
                <div className="input-wrap">
                  <input className="field-input" type="text" maxLength={60} placeholder="e.g. Saturday Night Bracket" value={name} onChange={(e) => setName(e.target.value)} aria-label="Game name" />
                </div>
                <div className="char-count">{name.length} / 60</div>
              </div>
              <div className="field-group">
                <div className="field-label"><span className="field-label-text">Description (optional)</span></div>
                <div className="input-wrap">
                  <textarea className="field-textarea" maxLength={500} rows={3} placeholder="Tell players what to expect — rules, vibe, what to bring…" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Game description" />
                </div>
                <div className="char-count">{desc.length} / 500</div>
              </div>
            </>
          )}

          {/* ── Step 4: Review ── */}
          {step === 3 && (
            <>
              <div className="field-group">
                {loading || !booking ? (
                  <div className="booked-court booked-court--loading">Loading your booked court…</div>
                ) : (
                  <div className="booked-court">
                    <div className="booked-court-badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Your booked court
                    </div>
                    <div className="booked-court-name">{booking.venueName || 'Booked court'}</div>
                    <div className="booked-court-meta">
                      {[prettyDate(booking.date), timeRange(booking), court].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-section-label">Your public game</div>
              <div className="wiz-summary">
                <div className="wiz-summary-row"><span>Format</span><strong>{formatLabel}</strong></div>
                <div className="wiz-summary-row"><span>Player slots</span><strong>{slots}</strong></div>
                <div className="wiz-summary-row"><span>Name</span><strong>{name.trim() || 'Untitled game'}</strong></div>
              </div>
            </>
          )}

          {error && <div className="vis-help" style={{ color: 'var(--warning)' }} role="alert">{error}</div>}
        </div>

        <div className="submit-wrap">
          <div className="wiz-nav">
            {step > 0 && (
              <button type="button" className="wiz-back" onClick={goBackStep} disabled={submitting}>Back</button>
            )}
            <button className="submit-btn" onClick={goNext} disabled={submitting || (step === STEP_COUNT - 1 && (loading || !booking))}>
              {step < STEP_COUNT - 1 ? 'Continue' : submitting ? 'Publishing…' : 'Publish public game'}
            </button>
          </div>
          <div className="submit-help">
            {step === STEP_COUNT - 1 && booking
              ? `Hosting at ${booking.venueName || 'your booked court'}${booking.startTime ? ` · ${to12h(booking.startTime)}` : ''}`
              : 'Your court is already booked — no extra charge.'}
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
