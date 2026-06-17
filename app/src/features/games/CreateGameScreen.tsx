import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CourtPicker } from '../../shared/components/ui/CourtPicker';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import type { Navigate } from '../../shared/lib/navigation';
import {
  listAllVenues, createBooking, checkout, getSettings, createGame, getGame, updateGame, kickPlayer, listCourts,
  type ApiVenue, type ApiCourt, type AppSettings, type CheckoutCard, type ApiGame, type ApiGamePerson,
} from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { locationLine, priceLabel, venueImage } from '../../shared/lib/venueDisplay';
import { addHours, hoursBetween, money, prettyDate, to12h, todayYMD } from '../bookings/bookingDisplay';

interface CreateGameScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** When set, the screen manages this existing game (details + roster) instead of creating one. */
  gameId?: string;
}

const TYPES = [
  { v: 'singles', label: 'Singles', sub: '1 vs 1' },
  { v: 'doubles', label: 'Doubles', sub: '2 vs 2' },
  { v: 'open',    label: 'Open',    sub: 'Mix-in' },
] as const;
type GameType = (typeof TYPES)[number]['v'];

const MAX_OPEN_SPOTS = 16;
/** Fixed player count a format seats: Singles 1v1 → 2, Doubles 2v2 → 4, Open → flexible (null). */
function fixedSpotsFor(t: GameType): number | null {
  return t === 'singles' ? 2 : t === 'doubles' ? 4 : null;
}

const SKILLS = ['Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+', 'Open'];

const TITLE_BY_STEP = ['Court & time', 'Game details', 'Payment'];

// How many courts to show before "Show all" (search bypasses this).
const COURT_LIMIT = 6;

/** A venue is bookable only if it has a rate (decision: require a price). */
function isBookable(v: ApiVenue): boolean {
  return v.priceFrom != null;
}

export function CreateGameScreen({ onNavigate, onBack, gameId }: CreateGameScreenProps) {
  // Editing an existing game is a different surface (details + roster, no
  // venue/schedule/payment), so it gets its own component.
  if (gameId) return <ManageGameScreen gameId={gameId} onBack={onBack} />;
  return <CreateGameWizard onNavigate={onNavigate} onBack={onBack} />;
}

/* ─── Create: venue → time → details → payment ─────────────────── */

function CreateGameWizard({ onNavigate, onBack }: { onNavigate: Navigate; onBack: () => void }) {
  const [step, setStep] = useState(0);

  // Court picker (priced venues only).
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [picking, setPicking] = useState(true);
  const [query, setQuery] = useState('');
  const [showAllCourts, setShowAllCourts] = useState(false);

  // Schedule — start + end hour; the duration (hours) is derived. Courts are
  // booked by the hour, so both times snap to the hour (no minutes).
  const [date, setDate] = useState(todayYMD());
  const [startTime, setStartTime] = useState('18:00');
  // End starts empty; it auto-fills to start + 1h the moment the user changes the
  // start (see onStartChange), and is otherwise picked by hand.
  const [endTime, setEndTime] = useState('');

  // Courts at the chosen venue. Each court is reserved independently, so the host
  // picks one; it drives availability and pins the game's court booking. Venues
  // with no defined courts fall back to a venue-level reservation (no picker).
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [courtId, setCourtId] = useState('');

  // Game details.
  const [type, setType] = useState<GameType>('doubles');
  const [skill, setSkill] = useState('3.0–3.5');
  const [name, setName] = useState('');
  const [spots, setSpots] = useState(4);
  const [vis, setVis] = useState<'public' | 'invite'>('public');

  // Checkout.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({ number: '', expiry: '', cvc: '' });
  const [cardTouched, setCardTouched] = useState(false);

  // Lifecycle.
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAllVenues()
      .then((items) => {
        if (!alive) return;
        const bookable = items.filter(isBookable);
        setVenues(bookable);
        setSelectedId((prev) => prev || bookable[0]?.id || '');
      })
      .catch(() => { /* picker shows an empty-state */ })
      .finally(() => { if (alive) setVenuesLoading(false); });
    return () => { alive = false; };
  }, []);

  // Load the chosen venue's courts; default to the first (host can switch). Reset
  // while a fresh venue loads.
  useEffect(() => {
    if (!selectedId) { setCourts([]); setCourtId(''); return; }
    let alive = true;
    setCourts([]); setCourtId('');
    listCourts(selectedId)
      .then((rows) => { if (!alive) return; setCourts(rows); setCourtId(rows[0]?.id ?? ''); })
      .catch(() => { if (alive) { setCourts([]); setCourtId(''); } });
    return () => { alive = false; };
  }, [selectedId]);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => { if (!alive) return; setSettings(s); if (s.paymentTestMode) setCard({ ...s.testCard }); })
      .catch(() => { /* default to the live card form */ });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);
  const currency = selected?.pricingCurrency ?? 'PHP';
  const rate = selected?.priceFrom ?? 0;
  const hours = hoursBetween(startTime, endTime);
  const total = Math.round(rate * hours * 100) / 100;

  // Live availability for the chosen court (or the venue pool when none) on this
  // date → greys out hours that court is already taken.
  const { availability, minBookableHour, startDisabled, endDisabledFor, rangeBlocked, firstFreeHour } = useVenueAvailability(selected?.id, date, courtId || undefined);
  const slotUnavailable = rangeBlocked(startTime, endTime);
  const startInPast = Number(startTime.split(':')[0]) < minBookableHour;
  const isTest = settings?.paymentTestMode ?? false;

  // Spots are fixed for Singles (2) / Doubles (4); only Open is adjustable.
  // Picking a format snaps the count and locks the stepper.
  const fixedSpots = fixedSpotsFor(type);
  const spotsLocked = fixedSpots != null;
  const minSpotsCreate = fixedSpots ?? 2;
  const maxSpotsCreate = fixedSpots ?? MAX_OPEN_SPOTS;
  const selectType = (v: GameType) => {
    setType(v);
    const fixed = fixedSpotsFor(v);
    if (fixed != null) setSpots(fixed);
  };

  // If the chosen court leaves the current start hour booked, jump the start to
  // the first free hour so the end picker isn't entirely blocked. End resets to
  // empty for the host to pick.
  // Keep the start on a valid hour: prefer the first free + future hour when
  // availability is loaded; otherwise just bump off an already-passed hour today.
  useEffect(() => {
    const cur = Number(startTime.split(':')[0]);
    const target = firstFreeHour(cur) ?? (cur < minBookableHour && minBookableHour <= 23 ? minBookableHour : null);
    if (target != null && target !== cur) { setStartTime(`${String(target).padStart(2, '0')}:00`); setEndTime(''); }
  }, [availability, startTime, firstFreeHour, minBookableHour]);

  const onStartChange = (v: string) => {
    setStartTime(v);
    if (hoursBetween(v, endTime) <= 0) setEndTime(addHours(v, 1));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) => `${v.displayName} ${locationLine(v)}`.toLowerCase().includes(q));
  }, [venues, query]);

  // Keep the picker short: show only the first few courts until the player
  // searches (search shows all matches) or taps "Show all".
  const isSearching = query.trim().length > 0;
  const visibleVenues = isSearching || showAllCourts ? filtered : filtered.slice(0, COURT_LIMIT);

  const totalSteps = 3;
  const back = () => (step > 0 ? (setError(null), setStep((s) => s - 1)) : onBack());

  const submit = async () => {
    if (!selected) { setError('Please choose a court.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      // Pay for + reserve the court, then post the game at that booked court.
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

  const next = () => {
    if (step === 0) {
      if (!selected) { setError('Please choose a venue.'); return; }
      if (courts.length > 0 && !courtId) { setError('Please choose a court.'); return; }
      if (!date) { setError('Please pick a date.'); return; }
      if (!startTime || !endTime) { setError('Please pick a start and end time.'); return; }
      if (!(hours > 0)) { setError('End time must be after the start time.'); return; }
      if (startInPast) { setError('That start time has already passed. Please pick a later time.'); return; }
      if (slotUnavailable) { setError('That time is fully booked. Please pick a free slot.'); return; }
    }
    setError(null);
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else void submit();
  };

  const setCardField = (k: keyof CheckoutCard, v: string) => {
    setCardTouched(true);
    setCard((c) => ({ ...c, [k]: v }));
  };

  if (doneId) {
    return (
      <CompletionScreen
        icon="check"
        title="Game created!"
        description="Your court is booked and your game is live. Players can now join — we'll fill the roster while you wait."
        actions={[
          // `replace` so backing out of the new game (or the invite screen) returns
          // to where the user started — not this now-submitted create form.
          { label: 'View game', variant: 'dark', onClick: () => onNavigate('game-details', { id: doneId }, { replace: true }) },
          { label: 'Invite players', variant: 'outline', onClick: () => onNavigate('invite-players', { id: doneId }, { replace: true }) },
        ]}
      />
    );
  }

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={back} backIcon={step === 0 ? 'close' : 'back'} eyebrow={`Step ${step + 1} of ${totalSteps}`} title={TITLE_BY_STEP[step]} />

      <div className="px-5 pb-4">
        <ProgressBar value={(step + 1) / totalSteps} />
      </div>

      {/* ─── Step 0: court & time ─────────────────────────────── */}
      {step === 0 && (
        <>
          <div className="field">
            <div className="flex items-center justify-between mb-2">
              <div className="lbl mb-0!">Court</div>
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
                No bookable courts right now — only venues with published rates can host a game.
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
                  <>
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                      {visibleVenues.map((v) => {
                        const photo = venueImage(v);
                        const sel = v.id === selectedId;
                        const meta = [priceLabel(v), locationLine(v) || 'Court'].filter(Boolean).join(' · ');
                        return (
                          <button
                            key={v.id}
                            onClick={() => { setSelectedId(v.id); setPicking(false); }}
                            className={`time-pick text-left px-3! py-2.5! flex items-center gap-3 ${sel ? 'bg-[var(--ink)]! text-white!' : 'bg-[var(--surface)]! text-[var(--ink)]!'}`}
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
                    {!isSearching && !showAllCourts && filtered.length > COURT_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setShowAllCourts(true)}
                        className="mt-2 w-full text-center text-[13px] font-bold text-[var(--primary)] py-2"
                      >
                        Show all {filtered.length} courts
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="field">
            <div className="lbl">Date</div>
            <input type="date" className="control" value={date} min={todayYMD()} onChange={(e) => setDate(e.target.value)} />
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
                    <div className="text-[13px] font-semibold text-[var(--muted)]">{money(rate, currency)}/hr × {hours} hr</div>
                    <div className="font-heading font-bold text-[22px] text-[var(--ink)]">{money(total, currency)}</div>
                  </>
                ) : !endTime ? (
                  <div className="text-[13px] font-semibold text-[var(--muted)]">Pick an end time to see the total.</div>
                ) : (
                  <div className="text-[13px] font-semibold text-[var(--coral)]">End time must be after the start time.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Step 1: game details ─────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="field">
            <div className="lbl">Game type</div>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((o) => (
                <button key={o.v} className={`time-pick flex flex-col items-center gap-1 p-3.5! ${type === o.v ? 'active' : ''}`} onClick={() => selectType(o.v)}>
                  <div>{o.label}</div>
                  <div className="text-[11px] font-semibold opacity-70">{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Skill level (DUPR)</div>
          </div>
          <div className="time-grid">
            {SKILLS.map((s) => (
              <button key={s} className={`time-pick ${skill === s ? 'active' : ''}`} onClick={() => setSkill(s)}>{s}</button>
            ))}
          </div>

          <div className="field mt-4">
            <div className="lbl">Game name (optional)</div>
            <input className="control" placeholder="e.g. Friday Night Dinks" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>

          <div className="field">
            <div className="lbl">Spots available · {spots}</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSpots((s) => Math.max(minSpotsCreate, s - 1))}
                disabled={spotsLocked || spots <= minSpotsCreate}
                className="w-11 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] flex items-center justify-center disabled:opacity-40"
              >
                <Icon name="minus" size={16} />
              </button>
              <div className="flex-1 text-center font-heading font-semibold text-[28px] text-[var(--ink)]">{spots}</div>
              <button
                onClick={() => setSpots((s) => Math.min(maxSpotsCreate, s + 1))}
                disabled={spotsLocked || spots >= maxSpotsCreate}
                className="w-11 h-11 rounded-xl bg-[var(--ink)] text-white flex items-center justify-center disabled:opacity-40"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
            {spotsLocked && (
              <div className="text-[11px] font-semibold text-[var(--muted)] mt-1.5">
                {type === 'singles' ? 'Singles is 1 vs 1 — fixed at 2 players.' : 'Doubles is 2 vs 2 — fixed at 4 players.'}
              </div>
            )}
          </div>

          <div className="field">
            <div className="lbl">Visibility</div>
            <div className="grid grid-cols-2 gap-2">
              <button className={`time-pick ${vis === 'public' ? 'active' : ''}`} onClick={() => setVis('public')}>🌍 Public</button>
              <button className={`time-pick ${vis === 'invite' ? 'active' : ''}`} onClick={() => setVis('invite')}>🔒 Invite only</button>
            </div>
          </div>
        </>
      )}

      {/* ─── Step 2: payment ──────────────────────────────────── */}
      {step === 2 && selected && (
        <>
          {isTest && (
            <div className="field">
              <div className="rounded-2xl bg-[var(--lime)]/20 border-[0.5px] border-[var(--lime)] px-4 py-3 flex items-start gap-3">
                <Icon name="science" size={20} className="mt-0.5 shrink-0 text-[var(--ink)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--ink)]">Test mode</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">A demo card is pre-filled and no real charge is made.</div>
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-[14px] truncate">{selected.displayName}</div>
                  <div className="text-[11px] opacity-70 font-semibold">{prettyDate(date)} · {to12h(startTime)}–{to12h(endTime)} · {hours} hr</div>
                </div>
                <div className="font-heading font-bold text-[18px] text-[var(--ink)]">{money(total, currency)}</div>
              </div>
              <div className="text-[12px] font-semibold text-[var(--muted)] mt-2 pt-2 border-t-[0.5px] border-[var(--hairline)]">
                {TYPES.find((t) => t.v === type)?.label} · {skill} · {spots} spots
              </div>
            </div>

            <div className="lbl">Card number</div>
            <input className="control" inputMode="numeric" placeholder="1234 5678 9012 3456" value={card.number ?? ''} onChange={(e) => setCardField('number', e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className="control" placeholder="MM/YY" value={card.expiry ?? ''} onChange={(e) => setCardField('expiry', e.target.value)} aria-label="Card expiry" />
              <input className="control" inputMode="numeric" placeholder="CVC" value={card.cvc ?? ''} onChange={(e) => setCardField('cvc', e.target.value)} aria-label="Card CVC" />
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
              <><Icon name="lock" size={16} /> Pay {money(total, currency)} & create</>
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

/* ─── Manage: edit details + roster (no venue/schedule/payment) ── */

const ROSTER_VARIANTS = ['lime', 'blue', 'coral'] as const;

function ManageGameScreen({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const me = useAuthStore((s) => s.user);
  const [game, setGame] = useState<ApiGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<GameType>('doubles');
  const [skill, setSkill] = useState('3.0–3.5');
  const [name, setName] = useState('');
  const [spots, setSpots] = useState(4);
  const [vis, setVis] = useState<'public' | 'invite'>('public');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getGame(gameId)
      .then((g) => {
        if (!alive) return;
        setGame(g);
        if (g.gameType === 'singles' || g.gameType === 'doubles' || g.gameType === 'open') setType(g.gameType);
        if (g.skillLabel) setSkill(g.skillLabel);
        setName(g.title || '');
        if (g.capacity) setSpots(g.capacity);
        setVis(g.visibility === 'invite' ? 'invite' : 'public');
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load this game.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gameId]);

  const participants = game?.participants ?? [];
  const creatorId = game?.creatorId || game?.creator?.id;
  const minSpots = Math.max(2, participants.length);

  // Singles/Doubles fix the seat count (but never below players already in); only
  // Open is adjustable. Picking a format snaps the count and locks the stepper.
  const fixedSpotsManage = fixedSpotsFor(type);
  const lockedSpots = fixedSpotsManage != null ? Math.max(fixedSpotsManage, participants.length) : null;
  const spotsLockedManage = lockedSpots != null;
  const minManage = lockedSpots ?? minSpots;
  const maxManage = lockedSpots ?? MAX_OPEN_SPOTS;
  const selectTypeManage = (v: GameType) => {
    setType(v);
    const fixed = fixedSpotsFor(v);
    if (fixed != null) setSpots(Math.max(fixed, participants.length));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateGame(gameId, {
        title: name.trim() || undefined,
        gameType: type,
        skillLabel: skill,
        capacity: spots,
        visibility: vis,
      });
      setGame(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const kick = async (userId: string) => {
    setKicking(userId);
    setError(null);
    try {
      const updated = await kickPlayer(gameId, userId);
      setGame(updated);
      setSpots((s) => Math.max(2, Math.min(s, updated.capacity ?? s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that player.');
    } finally {
      setKicking(null);
    }
  };

  if (loading) {
    return (
      <div className="scroll px-5 pt-[calc(28px+env(safe-area-inset-top))]">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (loadError || !game) {
    return (
      <div className="scroll px-5 pt-[calc(28px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} backIcon="back" eyebrow="Manage game" title="Couldn't load this game" />
        <div className="text-[13px] text-[var(--coral)] font-semibold px-1">{loadError}</div>
      </div>
    );
  }

  const venueName = game.venue?.displayName || game.venueName || 'Venue TBD';
  const when = [prettyDate(game.date), game.timeLabel].filter(Boolean).join(' · ');

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} backIcon="back" eyebrow="Manage game" title={game.title || 'Manage game'} />

      {/* Court + schedule are locked once booked. */}
      <div className="field">
        <div className="lbl">Court &amp; time</div>
        <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
          <div className="font-heading font-semibold text-[15px] text-[var(--ink)]">{venueName}</div>
          <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
            <Icon name="clock" size={13} /> {when || 'Schedule TBD'}{game.durationLabel ? ` · ${game.durationLabel}` : ''}
          </div>
          <div className="text-[11px] font-semibold text-[var(--muted)] mt-1.5 flex items-center gap-1">
            <Icon name="lock" size={11} /> Venue &amp; time are fixed once the court is booked.
          </div>
        </div>
      </div>

      <div className="field">
        <div className="lbl">Game type</div>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((o) => (
            <button key={o.v} className={`time-pick flex flex-col items-center gap-1 p-3.5! ${type === o.v ? 'active' : ''}`} onClick={() => selectTypeManage(o.v)}>
              <div>{o.label}</div>
              <div className="text-[11px] font-semibold opacity-70">{o.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Skill level (DUPR)</div>
      </div>
      <div className="time-grid">
        {SKILLS.map((s) => (
          <button key={s} className={`time-pick ${skill === s ? 'active' : ''}`} onClick={() => setSkill(s)}>{s}</button>
        ))}
      </div>

      <div className="field mt-4">
        <div className="lbl">Game name (optional)</div>
        <input className="control" placeholder="e.g. Friday Night Dinks" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>

      <div className="field">
        <div className="lbl">Spots available · {spots}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSpots((s) => Math.max(minManage, s - 1))}
            disabled={spotsLockedManage || spots <= minManage}
            className="w-11 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] flex items-center justify-center disabled:opacity-40"
          >
            <Icon name="minus" size={16} />
          </button>
          <div className="flex-1 text-center font-heading font-semibold text-[28px] text-[var(--ink)]">{spots}</div>
          <button
            onClick={() => setSpots((s) => Math.min(maxManage, s + 1))}
            disabled={spotsLockedManage || spots >= maxManage}
            className="w-11 h-11 rounded-xl bg-[var(--ink)] text-white flex items-center justify-center disabled:opacity-40"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        {spotsLockedManage ? (
          <div className="text-[11px] font-semibold text-[var(--muted)] mt-1.5">
            {type === 'singles' ? 'Singles is 1 vs 1 — fixed at 2 players.' : 'Doubles is 2 vs 2 — fixed at 4 players.'}
          </div>
        ) : minSpots > 2 ? (
          <div className="text-[11px] font-semibold text-[var(--muted)] mt-1.5">Can't go below the {participants.length} players already in.</div>
        ) : null}
      </div>

      <div className="field">
        <div className="lbl">Visibility</div>
        <div className="grid grid-cols-2 gap-2">
          <button className={`time-pick ${vis === 'public' ? 'active' : ''}`} onClick={() => setVis('public')}>🌍 Public</button>
          <button className={`time-pick ${vis === 'invite' ? 'active' : ''}`} onClick={() => setVis('invite')}>🔒 Invite only</button>
        </div>
      </div>

      {/* Roster — the host can remove players. */}
      <div className="field">
        <div className="lbl">Players · {participants.length}/{game.capacity ?? spots}</div>
        <div className="flex flex-col gap-2">
          {participants.map((p: ApiGamePerson, i) => {
            const isHost = p.id === creatorId;
            const isMe = p.id === me?.id;
            return (
              <div key={p.id} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3 flex items-center gap-3">
                <Avatar name={p.displayName || 'Player'} size={40} variant={ROSTER_VARIANTS[i % ROSTER_VARIANTS.length]} />
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">
                    {p.displayName || 'Player'}{isMe ? ' (you)' : ''}
                  </div>
                  {isHost && <div className="text-[11px] font-bold text-[var(--primary)]">Host</div>}
                </div>
                {!isHost && (
                  <button
                    type="button"
                    onClick={() => kick(p.id)}
                    disabled={kicking === p.id}
                    className="text-[12px] font-bold text-[var(--coral)] flex items-center gap-1 disabled:opacity-50"
                  >
                    {kicking === p.id
                      ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={13} /></span> Removing…</>
                      : <><Icon name="close" size={13} /> Remove</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="app-action-bar">
        {error && <div className="text-[13px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>}
        {saved && !error && <div className="text-[13px] text-[var(--primary)] font-semibold mb-2 text-center">Changes saved.</div>}
        <Button fullWidth onClick={save} disabled={saving}>
          {saving
            ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Saving…</>
            : <><Icon name="check" size={16} /> Save changes</>}
        </Button>
      </div>
    </div>
  );
}
