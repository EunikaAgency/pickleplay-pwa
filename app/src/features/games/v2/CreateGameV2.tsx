import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { CompletionScreen } from '../../../shared/components/ui/CompletionScreen';
import { useVenueAvailability } from '../../../shared/hooks/useVenueAvailability';
import {
  listAllVenues, listCourts, getSettings, createBooking, checkout, createGame,
  type ApiVenue, type AppSettings, type CheckoutCard, type OwnerCourt,
} from '../../../shared/lib/api';
import { locationLine } from '../../../shared/lib/venueDisplay';
import { addHours, hoursBetween, money, to12h, todayYMD } from '../../bookings/bookingDisplay';

type GameType = 'open' | 'doubles' | 'singles';
const isBookable = (v: ApiVenue) => v.priceFrom != null;
const fixedSpotsFor = (t: GameType): number | null => (t === 'singles' ? 2 : t === 'doubles' ? 4 : null);
const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i); // 6:00 → 22:00
const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`;

const SKILLS = ['All levels', 'Beginner (2.0–3.0)', 'Intermediate (3.0–4.0)', 'Advanced (4.0+)'];

interface Props extends V2ScreenChrome { onBack: () => void; }

export function CreateGameV2(props: Props) {
  const { onNavigate, onBack } = props;
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [courtId, setCourtId] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({ number: '', expiry: '', cvc: '' });

  const [name, setName] = useState('');
  const [date, setDate] = useState(todayYMD());
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [type, setType] = useState<GameType>('open');
  const [spots, setSpots] = useState(8);
  const [skill, setSkill] = useState(SKILLS[0]);
  const [vis, setVis] = useState<'public' | 'invite'>('public');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAllVenues()
      .then((items) => { if (!alive) return; const b = items.filter(isBookable); setVenues(b); setSelectedId((p) => p || b[0]?.id || ''); })
      .catch(() => { /* empty-state */ });
    getSettings().then((s) => { if (!alive) return; setSettings(s); if (s.paymentTestMode) setCard({ ...s.testCard }); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setCourts([]); setCourtId(''); return; }
    let alive = true;
    setCourts([]); setCourtId('');
    listCourts(selectedId).then((rows) => { if (!alive) return; setCourts(rows); setCourtId(rows[0]?.id ?? ''); }).catch(() => {});
    return () => { alive = false; };
  }, [selectedId]);

  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);
  const currency = selected?.pricingCurrency ?? 'PHP';
  const rate = selected?.priceFrom ?? 0;
  const hours = hoursBetween(startTime, endTime);
  const total = Math.round(rate * hours * 100) / 100;
  const isTest = settings?.paymentTestMode ?? false;

  const { minBookableHour, rangeBlocked } = useVenueAvailability(selected?.id, date, courtId || undefined);
  const slotUnavailable = rangeBlocked(startTime, endTime);
  const startInPast = Number(startTime.split(':')[0]) < minBookableHour;

  const fixedSpots = fixedSpotsFor(type);
  const selectType = (v: GameType) => { setType(v); const f = fixedSpotsFor(v); if (f != null) setSpots(f); };
  const onStartChange = (v: string) => { setStartTime(v); if (hoursBetween(v, endTime) <= 0) setEndTime(addHours(v, 1)); };

  const submit = async () => {
    if (!selected) { setError('Please choose a court.'); return; }
    if (!date) { setError('Please pick a date.'); return; }
    if (!(hours > 0)) { setError('End time must be after the start time.'); return; }
    if (startInPast) { setError('That start time has already passed. Pick a later time.'); return; }
    if (slotUnavailable) { setError('That time is fully booked. Pick a free slot.'); return; }
    if (!isTest && !(card.number && card.expiry && card.cvc)) { setError('Enter card details to reserve the court.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking({ venueId: selected.id, courtId: courtId || undefined, date, startTime, endTime, amount: total });
      await checkout({ bookingId: booking.id, amount: total, currency, method: isTest ? 'test_card' : 'card', card });
      const game = await createGame({
        title: name.trim() || undefined,
        venueId: selected.id,
        gameType: type,
        skillLabel: skill,
        timeLabel: to12h(startTime),
        durationLabel: `${hours} hr`,
        date,
        capacity: spots,
        visibility: vis,
        bookingId: booking.id,
      });
      setDoneId(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (doneId) {
    return (
      <CompletionScreen
        icon="check"
        title="Game created!"
        description="Your court is booked and your game is live. Invite players or view the details."
        actions={[
          { label: 'View game', variant: 'dark', onClick: () => onNavigate('game-details', { id: doneId }, { replace: true }) },
          { label: 'Done', variant: 'outline', onClick: onBack },
        ]}
      />
    );
  }

  const noVenues = venues.length === 0;

  return (
    <V2Shell screen="v2-creategame" chrome={props} onBack={onBack} hideTabBar hideFab>
      <div className="page">
        <div className="page-hero" role="banner">
          <div className="page-hero-eyebrow">Games</div>
          <h1>Create a Game</h1>
          <p className="page-hero-sub">Book a court and set up your session.</p>
          <div className="step-row" aria-hidden="true">
            <div className="step-dot active" /><div className="step-dot" /><div className="step-dot" />
          </div>
        </div>

        <div className="form-card">
          <div className="form-section-label">Basic Info</div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Game Name</span></div>
            <div className="input-wrap">
              <input className="field-input" type="text" maxLength={60} placeholder="e.g. Saturday Morning Mix-In" value={name} onChange={(e) => setName(e.target.value)} aria-label="Game name" />
            </div>
            <div className="char-count">{name.length} / 60</div>
          </div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Court</span></div>
            <div className="input-wrap">
              <select className="field-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Court" disabled={noVenues}>
                {noVenues && <option value="">No bookable courts available</option>}
                {venues.map((v) => <option key={v.id} value={v.id}>{v.displayName} · {locationLine(v)}</option>)}
              </select>
            </div>
          </div>

          {courts.length > 0 && (
            <div className="field-group">
              <div className="field-label"><span className="field-label-text">Court area</span></div>
              <div className="input-wrap">
                <select className="field-input" value={courtId} onChange={(e) => setCourtId(e.target.value)} aria-label="Court area">
                  {courts.map((c) => <option key={c.id} value={c.id}>{c.courtName || `Court ${c.courtNumber}`}</option>)}
                </select>
              </div>
            </div>
          )}

          <hr className="form-divider" />
          <div className="form-section-label">Date &amp; Time</div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Date</span></div>
            <div className="input-wrap">
              <input className="field-input" type="date" value={date} min={todayYMD()} onChange={(e) => setDate(e.target.value)} aria-label="Game date" />
            </div>
          </div>

          <div className="field-row-2">
            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label"><span className="field-label-text">Start</span></div>
              <div className="input-wrap">
                <select className="field-input" value={startTime} onChange={(e) => onStartChange(e.target.value)} aria-label="Start time">
                  {HOURS.map((h) => <option key={h} value={hhmm(h)}>{to12h(hhmm(h))}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <div className="field-label"><span className="field-label-text">End</span></div>
              <div className="input-wrap">
                <select className="field-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="End time">
                  {HOURS.concat(23).map((h) => <option key={h} value={hhmm(h)}>{to12h(hhmm(h))}</option>)}
                </select>
              </div>
            </div>
          </div>
          {slotUnavailable && <div className="vis-help" style={{ color: 'var(--warning)' }}>That time is fully booked — pick a free slot.</div>}

          <hr className="form-divider" />
          <div className="form-section-label">Players &amp; Skill</div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Max Players</span></div>
            <div className="stepper-wrap">
              <button className="stepper-btn" onClick={() => setSpots((s) => Math.max(2, s - 1))} disabled={fixedSpots != null} aria-label="Decrease players">−</button>
              <input className="stepper-value" type="number" value={spots} readOnly aria-label="Number of players" />
              <button className="stepper-btn" onClick={() => setSpots((s) => Math.min(32, s + 1))} disabled={fixedSpots != null} aria-label="Increase players">+</button>
            </div>
          </div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Skill Level</span></div>
            <div className="input-wrap">
              <select className="field-input" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill level">
                {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <hr className="form-divider" />
          <div className="form-section-label">Game Format</div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Type</span></div>
            <div className="type-grid" role="group" aria-label="Game type">
              {(['open', 'doubles', 'singles'] as GameType[]).map((t) => (
                <button key={t} className={`type-option${type === t ? ' active' : ''}`} aria-pressed={type === t} onClick={() => selectType(t)}>
                  <div className="type-icon">{t === 'open' ? '🏓' : t === 'doubles' ? '👥' : '🎯'}</div>
                  {t === 'open' ? 'Open Play' : t === 'doubles' ? 'Doubles' : 'Singles'}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <div className="field-label"><span className="field-label-text">Visibility</span></div>
            <div className="vis-toggle" role="group" aria-label="Game visibility">
              <button className={`vis-btn${vis === 'public' ? ' active' : ''}`} aria-pressed={vis === 'public'} onClick={() => setVis('public')}>Public</button>
              <button className={`vis-btn${vis === 'invite' ? ' active' : ''}`} aria-pressed={vis === 'invite'} onClick={() => setVis('invite')}>Invite only</button>
            </div>
            <div className="vis-help">{vis === 'public' ? 'Anyone nearby can discover and join this game.' : 'Only people you invite can join.'}</div>
          </div>

          <hr className="form-divider" />
          <div className="form-section-label">Payment</div>
          {isTest ? (
            <div className="vis-help">Test mode — your card won't be charged.</div>
          ) : (
            <div className="field-row-2">
              <div className="field-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <div className="field-label"><span className="field-label-text">Card number</span></div>
                <div className="input-wrap"><input className="field-input" inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></div>
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <div className="field-label"><span className="field-label-text">Expiry</span></div>
                <div className="input-wrap"><input className="field-input" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} /></div>
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <div className="field-label"><span className="field-label-text">CVC</span></div>
                <div className="input-wrap"><input className="field-input" inputMode="numeric" placeholder="123" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></div>
              </div>
            </div>
          )}

          {error && <div className="vis-help" style={{ color: 'var(--warning)' }} role="alert">{error}</div>}
        </div>

        <div className="submit-wrap">
          <button className="submit-btn" onClick={submit} disabled={submitting || noVenues}>
            {submitting ? 'Creating…' : `Book & Create${total > 0 ? ` · ${money(total, currency)}` : ''}`}
          </button>
          <div className="submit-help">{hours > 0 ? `${money(rate, currency)}/hr × ${hours} hr` : 'Pick a start and end time'}</div>
        </div>
      </div>
    </V2Shell>
  );
}
