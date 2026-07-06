import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { CompletionScreen } from '../../../shared/components/ui/CompletionScreen';
import { getBooking, createGame, type ApiBooking } from '../../../shared/lib/api';
import { hoursBetween, prettyDate, timeRange, to12h } from '../../bookings/bookingDisplay';

interface Props extends V2ScreenChrome {
  onBack: () => void;
  /** The court reservation this lobby is hosted on (chosen in the booking flow). */
  bookingId?: string;
}

/**
 * Publish Open Play on a court the player has already booked. Booking and payment
 * happen up front in the Book flow; this screen only collects the Open Play
 * details before calling `createGame({ bookingId })`.
 */
export function CreateGameV2(props: Props) {
  const { onNavigate, onBack, bookingId } = props;

  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [loading, setLoading] = useState(!!bookingId);
  const [loadError, setLoadError] = useState(false);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  // Load the booking this lobby is hosted on (venue/date/time come from it).
  // `bookingId` is a stable route param, so this runs once; the initial state
  // (loading = !!bookingId) means the effect body never sets state synchronously.
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

  const submit = async () => {
    if (!booking) { setError('Your booked court could not be loaded.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const game = await createGame({
        title: name.trim() || undefined,
        description: desc.trim() || undefined,
        venueId: booking.venueId ?? undefined,
        venueName: booking.venueName ?? undefined,
        gameType: 'open',
        skillLabel: 'All levels',
        timeLabel: booking.startTime ? to12h(booking.startTime) : undefined,
        durationLabel: hours > 0 ? `${hours} hr` : undefined,
        date: booking.date ?? undefined,
        visibility: 'public',
        bookingId: booking.id,
      });
      setDoneId(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish Open Play. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (doneId) {
    return (
      <CompletionScreen
        icon="check"
        title="Open Play published!"
        description="Your Open Play is live on your booked court. Players can now discover and join it."
        actions={[
          { label: 'View Open Play', variant: 'dark', onClick: () => onNavigate('open-play-detail', { source: 'game', id: doneId }, { replace: true }) },
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
            <h1>Make Open Play</h1>
            <p className="page-hero-sub">Publish a public Open Play session from a court you booked.</p>
          </div>
          <div className="form-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎾</div>
            <div className="form-section-label" style={{ textAlign: 'center' }}>
              {loadError ? 'We couldn’t load that booking' : 'Book a court first'}
            </div>
            <p className="page-hero-sub" style={{ color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              Open Play needs a reserved court. Book one first, then publish it for others to join.
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
          <div className="page-hero-eyebrow">Games</div>
          <h1>Set up Open Play</h1>
          <p className="page-hero-sub">Your court is booked - now publish it as Open Play.</p>
        </div>

        <div className="form-card">
          {/* Locked reservation — venue, date and time come from the booking. */}
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

          <div className="form-section-label">Basic Info</div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Open Play Name</span></div>
            <div className="input-wrap">
              <input className="field-input" type="text" maxLength={60} placeholder="e.g. Saturday Morning Mix-In" value={name} onChange={(e) => setName(e.target.value)} aria-label="Game name" />
            </div>
            <div className="char-count">{name.length} / 60</div>
          </div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Description (optional)</span></div>
            <div className="input-wrap">
              <textarea className="field-input" maxLength={500} rows={3} placeholder="Tell players what to expect — rules, vibe, what to bring…" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Game description" />
            </div>
            <div className="char-count">{desc.length} / 500</div>
          </div>

          {error && <div className="vis-help" style={{ color: 'var(--warning)' }} role="alert">{error}</div>}
        </div>

        <div className="submit-wrap">
          <button className="submit-btn" onClick={submit} disabled={submitting || loading || !booking}>
            {submitting ? 'Creating…' : 'Publish Open Play'}
          </button>
          <div className="submit-help">
            {booking ? `Hosting at ${booking.venueName || 'your booked court'}${booking.startTime ? ` · ${to12h(booking.startTime)}` : ''}` : 'Your court is already booked — no extra charge.'}
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
