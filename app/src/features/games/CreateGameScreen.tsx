import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, useMap, useMapEvents } from 'react-leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import type { Navigate } from '../../shared/lib/navigation';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { listAllVenues, createGame, getGame, updateGame, type ApiVenue } from '../../shared/lib/api';
import { venueCoords } from '../../shared/lib/venueDisplay';
import { getCurrentLocation, haversineKm, type LatLng } from '../../shared/lib/geo';

interface CreateGameScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** When set, the screen edits this existing game instead of creating a new one. */
  gameId?: string;
}

const TYPES = [
  { v: 'singles', label: 'Singles', sub: '1 vs 1' },
  { v: 'doubles', label: 'Doubles', sub: '2 vs 2' },
  { v: 'open',    label: 'Open',    sub: 'Mix-in' },
] as const;

const SKILLS = ['Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+', 'Open'];
const WHEN   = ['Tonight', 'Tomorrow', 'This weekend', 'Next week', 'Custom', 'Recurring'];
const TIMES  = ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', 'Custom'];
const DURATIONS = ['1 hr', '1.5 hr', '2 hr', '3 hr', 'Custom'];

// Vote-flow ranges (km). The host sets how far they're willing to play; players
// within this radius can join and later vote on the actual venue.
const RANGES = [2, 5, 10, 25] as const;

const TITLE_BY_STEP = ['What kind of game?', 'When are you playing?', 'Where & who?'];

// Metro Manila — most seeded venues are here; used to center the map when no
// venue carries coordinates and the user hasn't shared their location.
const MAP_FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

/** Frame the map around the whole range circle, so it zooms out as the range
 *  grows and recenters when the search center moves. */
function FitToRange({ center, rangeKm }: { center: LatLng; rangeKm: number }) {
  const map = useMap();
  useEffect(() => {
    const [lat, lng] = center;
    // Bounding box of the circle: ~111 km per degree of latitude; longitude
    // degrees shrink by cos(latitude).
    const dLat = rangeKm / 111;
    const dLng = rangeKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
    map.fitBounds([[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]], { padding: [18, 18] });
  }, [map, center, rangeKm]);
  return null;
}

/** Lets the host tap the map to move the game's search center. */
function ClickToSetCenter({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Local YYYY-MM-DD (matches how the API stores a game's date). */
function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "14:30" → "2:30 PM" for the timeLabel we store/display. */
function to12h(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "6:30 PM" → "18:30" for prefilling the <input type="time"> on edit. */
function to24h(label: string): string {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function CreateGameScreen({ onNavigate, onBack, gameId }: CreateGameScreenProps) {
  const isEdit = !!gameId;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [type, setType] = useState<typeof TYPES[number]['v']>('doubles');
  const [skill, setSkill] = useState('3.0–3.5');
  const [name, setName] = useState('');
  const [when, setWhen] = useState('Tonight');
  const [time, setTime] = useState('6:30 PM');
  const [duration, setDuration] = useState('2 hr');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [spots, setSpots] = useState(4);
  const [vis, setVis] = useState<'public' | 'invite'>('public');

  // Vote flow: the host sets a search CENTER + RANGE instead of a fixed venue.
  // Players within range join, then the lobby votes on the actual court later.
  const [center, setCenter] = useState<LatLng | null>(null);
  const [rangeKm, setRangeKm] = useState<number>(10);
  const [rangeCustom, setRangeCustom] = useState(false);   // free-input range mode
  const [customRange, setCustomRange] = useState('');
  const centerTouched = useRef(false);

  // Real venues — shown as context (how many courts fall in range) on step 3.
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);

  // Geolocation for the map + auto-centering the search range.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const locTried = useRef(false);

  // Submission lifecycle (also carries step-validation messages).
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGameId, setNewGameId] = useState<string | null>(null);

  // Edit mode: load the game and prefill the form once.
  const [loadingGame, setLoadingGame] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setVenuesLoading(true);
    listAllVenues()
      .then((items) => { if (alive) setVenues(items); })
      .catch(() => { /* the in-range count just shows 0; the game can still post */ })
      .finally(() => { if (alive) setVenuesLoading(false); });
    return () => { alive = false; };
  }, []);

  // Prefill from the existing game when editing.
  useEffect(() => {
    if (!gameId) return;
    let alive = true;
    setLoadingGame(true);
    setLoadError(null);
    getGame(gameId)
      .then((g) => {
        if (!alive) return;
        if (g.gameType === 'singles' || g.gameType === 'doubles' || g.gameType === 'open') setType(g.gameType);
        if (g.skillLabel) setSkill(g.skillLabel);
        setName(g.title || '');
        // When: a relative preset, else fall back to a Custom calendar date.
        if (g.whenLabel && WHEN.includes(g.whenLabel) && g.whenLabel !== 'Custom') setWhen(g.whenLabel);
        else { setWhen('Custom'); setCustomDate(g.date || ''); }
        // Time: a preset, else Custom + the 24h value for the picker.
        if (g.timeLabel && TIMES.includes(g.timeLabel)) setTime(g.timeLabel);
        else if (g.timeLabel) { setTime('Custom'); setCustomTime(to24h(g.timeLabel)); }
        // Duration: a preset, else Custom + the numeric hours.
        if (g.durationLabel && DURATIONS.includes(g.durationLabel)) setDuration(g.durationLabel);
        else if (g.durationLabel) { setDuration('Custom'); setCustomDuration(String(parseFloat(g.durationLabel) || '')); }
        if (g.capacity) setSpots(g.capacity);
        setVis(g.visibility === 'invite' ? 'invite' : 'public');
        // Range + center — keep what the host chose; don't let geolocation override it.
        if (g.locationCenter?.lat != null && g.locationCenter?.lng != null) {
          setCenter([g.locationCenter.lat, g.locationCenter.lng]);
          centerTouched.current = true;
          locTried.current = true;
        }
        if (g.rangeKm != null) {
          setRangeKm(g.rangeKm);
          if (!(RANGES as readonly number[]).includes(g.rangeKm)) { setRangeCustom(true); setCustomRange(String(g.rangeKm)); }
        }
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load this game.'); })
      .finally(() => { if (alive) setLoadingGame(false); });
    return () => { alive = false; };
  }, [gameId]);

  const handleLocate = () => {
    if (locating) return;
    setLocating(true);
    setLocError(null);
    getCurrentLocation()
      .then((loc) => setUserLoc(loc))
      .catch((err: Error) => setLocError(err.message))
      .finally(() => setLocating(false));
  };

  // Ask for location once, the first time the user reaches the "Where" step.
  useEffect(() => {
    if (step !== 2 || userLoc || locTried.current) return;
    locTried.current = true;
    handleLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Once located, center the search range on the user — unless they moved it.
  useEffect(() => {
    if (userLoc && !centerTouched.current) setCenter(userLoc);
  }, [userLoc]);

  const pickCenter = (p: LatLng) => {
    centerTouched.current = true;
    setCenter(p);
  };

  // Locatable venues + their distance from the chosen center, and which fall in
  // range — shown as context so the host knows there are courts to vote on.
  const located = useMemo(
    () =>
      venues
        .map((v) => ({ v, coords: venueCoords(v) }))
        .filter((r): r is { v: ApiVenue; coords: [number, number] } => !!r.coords)
        .map((r) => ({ ...r, distanceKm: center ? haversineKm(center, r.coords) : null })),
    [venues, center],
  );
  const inRange = useMemo(
    () => located.filter((r) => r.distanceKm != null && r.distanceKm <= rangeKm).sort((a, b) => (a.distanceKm! - b.distanceKm!)),
    [located, rangeKm],
  );

  const mapPoints = useMemo<[number, number][]>(() => located.map((r) => r.coords), [located]);
  const mapCenter: [number, number] = center ?? userLoc ?? mapPoints[0] ?? MAP_FALLBACK_CENTER;

  const totalSteps = 3;
  const back = () => (step > 0 ? (setError(null), setStep((s) => s - 1)) : onBack());

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const loc = center ?? userLoc;
      const payload = {
        title: name.trim() || undefined,
        gameType: type,
        skillLabel: skill,
        whenLabel: when,
        timeLabel: time === 'Custom' ? to12h(customTime) : time,
        durationLabel: duration === 'Custom' ? `${customDuration} hr` : duration,
        date: when === 'Custom' ? customDate : undefined,
        capacity: spots,
        visibility: vis,
        // Vote flow: post a search center + range; the venue is voted on later.
        locationCenter: loc ? { lat: loc[0], lng: loc[1] } : undefined,
        rangeKm,
      };
      const game = isEdit ? await updateGame(gameId!, payload) : await createGame(payload);
      setNewGameId(game.id);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEdit ? 'Could not save your changes. Please try again.' : 'Could not post your game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    // Validate the "when" step's custom fields before advancing off it.
    if (step === 1) {
      if (when === 'Custom' && !customDate) { setError('Please pick a date for your game.'); return; }
      if (time === 'Custom' && !customTime) { setError('Please pick a start time.'); return; }
      if (duration === 'Custom' && !(Number(customDuration) > 0)) { setError('Please enter a duration in hours.'); return; }
    }
    setError(null);
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else void submit();
  };

  // Edit mode: hold the wizard until the game is loaded (or surface a failure).
  if (isEdit && loadingGame) {
    return (
      <div className="scroll px-5 pt-[calc(28px+env(safe-area-inset-top))]">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (isEdit && loadError) {
    return (
      <div className="scroll px-5 pt-[calc(28px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} backIcon="back" eyebrow="Edit game" title="Couldn't load this game" />
        <div className="text-[13px] text-[var(--coral)] font-semibold px-1">{loadError}</div>
      </div>
    );
  }

  if (done && newGameId) {
    return isEdit ? (
      <CompletionScreen
        icon="check"
        title="Game updated!"
        description="Your changes are saved. Players in range still see the latest details."
        actions={[
          { label: 'Open lobby', variant: 'dark', onClick: () => onNavigate('game-lobby', { id: newGameId }) },
          { label: 'Done', variant: 'outline', onClick: () => onNavigate('my-games') },
        ]}
      />
    ) : (
      <CompletionScreen
        icon="check"
        title="Lobby created!"
        description="Players within your range can now join. Once the lobby fills, your group votes on a venue — then you book it."
        actions={[
          { label: 'Open lobby', variant: 'dark', onClick: () => onNavigate('game-lobby', { id: newGameId }) },
          { label: 'Invite players', variant: 'outline', onClick: () => onNavigate('invite-players', { id: newGameId }) },
        ]}
      />
    );
  }

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={back}
        backIcon={step === 0 ? 'close' : 'back'}
        eyebrow={isEdit ? `Edit · Step ${step + 1} of ${totalSteps}` : `Step ${step + 1} of ${totalSteps}`}
        title={TITLE_BY_STEP[step]}
      />

      <div className="px-5 pb-4">
        <ProgressBar value={(step + 1) / totalSteps} />
      </div>

      {step === 0 && (
        <>
          <div className="field">
            <div className="lbl">Game type</div>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((o) => (
                <button
                  key={o.v}
                  className={`time-pick flex flex-col items-center gap-1 p-3.5! ${type === o.v ? 'active' : ''}`}
                  onClick={() => setType(o.v)}
                >
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
              <button key={s} className={`time-pick ${skill === s ? 'active' : ''}`} onClick={() => setSkill(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="field mt-4">
            <div className="lbl">Game name (optional)</div>
            <input
              className="control"
              placeholder="e.g. Friday Night Dinks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="field">
            <div className="lbl">When</div>
          </div>
          <div className="time-grid">
            {WHEN.map((s) => (
              <button key={s} className={`time-pick ${when === s ? 'active' : ''}`} onClick={() => setWhen(s)}>
                {s}
              </button>
            ))}
          </div>
          {when === 'Custom' && (
            <div className="field mt-3">
              <div className="lbl">Pick a date</div>
              <input
                type="date"
                className="control"
                value={customDate}
                min={todayYMD()}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          )}

          <div className="field mt-4">
            <div className="lbl">Start time</div>
          </div>
          <div className="time-grid">
            {TIMES.map((t) => (
              <button key={t} className={`time-pick ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>
          {time === 'Custom' && (
            <div className="field mt-3">
              <div className="lbl">Pick a start time</div>
              <input
                type="time"
                className="control"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
          )}

          <div className="field mt-4">
            <div className="lbl">Duration</div>
          </div>
          <div className="time-grid">
            {DURATIONS.map((d) => (
              <button key={d} className={`time-pick ${duration === d ? 'active' : ''}`} onClick={() => setDuration(d)}>{d}</button>
            ))}
          </div>
          {duration === 'Custom' && (
            <div className="field mt-3">
              <div className="lbl">Duration (hours)</div>
              <input
                type="number"
                className="control"
                placeholder="e.g. 2.5"
                value={customDuration}
                min={0.5}
                step={0.5}
                onChange={(e) => setCustomDuration(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="field">
            <div className="flex items-center justify-between mb-2">
              <div className="lbl mb-0!">Play area</div>
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className={`chip ${center ? 'lime' : ''}`}
                aria-pressed={!!center}
              >
                <Icon name={locating ? 'spinner' : 'navigate'} size={12} className={locating ? 'animate-spin' : ''} />
                {locating ? 'Locating…' : center ? 'Centered on you' : 'Use my location'}
              </button>
            </div>

            <div className="text-[12px] text-[var(--muted)] font-semibold mb-2">
              You don't pick the court yet — set where you want to play. Players in
              range join, then your group votes on the venue. Tap the map to move
              the center.
            </div>

            {locError && (
              <div className="text-[12px] text-[var(--coral)] font-semibold mb-2 flex items-center gap-1.5">
                <Icon name="location" size={13} /> {locError}
              </div>
            )}

            {/* Map — the search center + range ring, with courts that fall inside */}
            {!venuesLoading && (
              <div className="relative z-0 h-[220px] rounded-2xl overflow-hidden border-[0.5px] border-[var(--hairline)] mb-3">
                <MapContainer center={mapCenter} zoom={12} className="w-full h-full" zoomControl={false} scrollWheelZoom={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ClickToSetCenter onPick={pickCenter} />
                  {center && (
                    <>
                      <FitToRange center={center} rangeKm={rangeKm} />
                      <Circle
                        center={center}
                        radius={rangeKm * 1000}
                        pathOptions={{ color: '#0040e0', weight: 1.5, fillColor: '#0040e0', fillOpacity: 0.08 }}
                      />
                      <CircleMarker
                        center={center}
                        radius={8}
                        pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0040e0', fillOpacity: 1 }}
                      />
                    </>
                  )}
                  {mapPoints.map((coords, i) => (
                    <CircleMarker
                      key={i}
                      center={coords}
                      radius={5}
                      pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: '#C1F100', fillOpacity: 1 }}
                    />
                  ))}
                </MapContainer>
              </div>
            )}

            {/* Range presets + custom */}
            <div className="lbl">Range · {rangeKm} km</div>
            <div className="time-grid">
              {RANGES.map((r) => (
                <button
                  key={r}
                  className={`time-pick ${!rangeCustom && rangeKm === r ? 'active' : ''}`}
                  onClick={() => { setRangeCustom(false); setRangeKm(r); }}
                >
                  {r} km
                </button>
              ))}
              <button
                className={`time-pick ${rangeCustom ? 'active' : ''}`}
                onClick={() => { setRangeCustom(true); if (customRange) setRangeKm(Number(customRange)); }}
              >
                Custom
              </button>
            </div>
            {rangeCustom && (
              <div className="field mt-3">
                <div className="lbl">Custom range (km)</div>
                <input
                  type="number"
                  className="control"
                  placeholder="e.g. 40"
                  value={customRange}
                  min={1}
                  max={200}
                  step={1}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCustomRange(raw);
                    const n = Number(raw);
                    if (n > 0) setRangeKm(Math.min(200, Math.max(1, n)));
                  }}
                />
              </div>
            )}

            <div className="text-[12px] font-semibold mt-2 flex items-center gap-1.5 text-[var(--muted)]">
              <Icon name="paddle" size={13} />
              {venuesLoading
                ? 'Checking courts in range…'
                : !center
                  ? 'Set a center to see courts in range'
                  : inRange.length > 0
                    ? `${inRange.length} court${inRange.length === 1 ? '' : 's'} in range to vote on`
                    : 'No courts in range yet — widen the range so there are venues to vote on'}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Spots available · {spots}</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSpots((s) => Math.max(2, s - 1))}
                className="w-11 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] flex items-center justify-center"
              >
                <Icon name="minus" size={16} />
              </button>
              <div className="flex-1 text-center font-heading font-semibold text-[28px] text-[var(--ink)]">
                {spots}
              </div>
              <button
                onClick={() => setSpots((s) => Math.min(16, s + 1))}
                className="w-11 h-11 rounded-xl bg-[var(--ink)] text-white flex items-center justify-center"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
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

      <div className="app-action-bar">
        {error && (
          <div className="text-[13px] text-[var(--coral)] font-semibold mb-2 text-center">{error}</div>
        )}
        <Button fullWidth onClick={next} disabled={submitting}>
          {step === totalSteps - 1 ? (
            submitting ? (
              <>
                <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> {isEdit ? 'Saving…' : 'Posting…'}
              </>
            ) : (
              <>
                <Icon name="bolt" size={18} /> {isEdit ? 'Save changes' : 'Post game'}
              </>
            )
          ) : (
            <>
              Continue <Icon name="forward" size={16} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
