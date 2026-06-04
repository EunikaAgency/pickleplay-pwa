import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import type { Navigate } from '../../shared/lib/navigation';
import { listAllVenues, createGame, type ApiVenue } from '../../shared/lib/api';
import { locationLine, venueCoords, venueImage } from '../../shared/lib/venueDisplay';
import { getCurrentLocation, haversineKm, formatDistance, type LatLng } from '../../shared/lib/geo';

interface CreateGameScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
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

const TITLE_BY_STEP = ['What kind of game?', 'When are you playing?', 'Where & who?'];

// Metro Manila — most seeded venues are here; used to center the map when no
// venue carries coordinates and the user hasn't shared their location.
const MAP_FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Frame the map around the given points; refits whenever the set changes. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
  }, [map, points]);
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

export function CreateGameScreen({ onNavigate, onBack }: CreateGameScreenProps) {
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

  // Real venues for the court picker (step 3), sorted nearest-first once located.
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venueId, setVenueId] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const venueTouched = useRef(false);

  // Geolocation for nearest-court sorting + the map.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const locTried = useRef(false);

  // Submission lifecycle (also carries step-validation messages).
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGameId, setNewGameId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setVenuesLoading(true);
    listAllVenues()
      .then((items) => {
        if (!alive) return;
        setVenues(items);
        setVenueId((prev) => prev || items[0]?.id || '');
      })
      .catch(() => { /* picker shows an empty-state; the game can still post without a venue */ })
      .finally(() => { if (alive) setVenuesLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectVenue = (id: string) => {
    venueTouched.current = true;
    setVenueId(id);
  };

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

  // Venues with coords + distance, ranked nearest-first when located.
  const ranked = useMemo(() => {
    const rows = venues.map((v) => {
      const coords = venueCoords(v);
      const distanceKm = userLoc && coords ? haversineKm(userLoc, coords) : null;
      return { v, coords, distanceKm };
    });
    if (userLoc) {
      rows.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return a.v.displayName.localeCompare(b.v.displayName);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return rows;
  }, [venues, userLoc]);

  // Once located, auto-select the nearest court — unless the user already chose one.
  useEffect(() => {
    if (!userLoc || venueTouched.current) return;
    const nearest = ranked.find((r) => r.coords);
    if (nearest) setVenueId(nearest.v.id);
  }, [userLoc, ranked]);

  // Name/area search — lets the user find a preferred venue that isn't nearby.
  // Narrows both the list and the map pins; ranking (nearest-first) is preserved.
  const filtered = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(({ v }) => `${v.displayName} ${locationLine(v)}`.toLowerCase().includes(q));
  }, [ranked, venueQuery]);

  const locatable = useMemo(() => filtered.filter((r) => r.coords) as { v: ApiVenue; coords: [number, number]; distanceKm: number | null }[], [filtered]);
  const mapPoints = useMemo<[number, number][]>(() => locatable.map((r) => r.coords), [locatable]);
  const fitPoints = useMemo<[number, number][]>(() => (userLoc ? [userLoc, ...mapPoints] : mapPoints), [userLoc, mapPoints]);
  const mapCenter: [number, number] = userLoc ?? mapPoints[0] ?? MAP_FALLBACK_CENTER;
  const selectedCoords = locatable.find((r) => r.v.id === venueId)?.coords ?? null;

  const totalSteps = 3;
  const back = () => (step > 0 ? (setError(null), setStep((s) => s - 1)) : onBack());

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const game = await createGame({
        title: name.trim() || undefined,
        venueId: venueId || undefined,
        gameType: type,
        skillLabel: skill,
        whenLabel: when,
        timeLabel: time === 'Custom' ? to12h(customTime) : time,
        durationLabel: duration === 'Custom' ? `${customDuration} hr` : duration,
        date: when === 'Custom' ? customDate : undefined,
        capacity: spots,
        visibility: vis,
      });
      setNewGameId(game.id);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post your game. Please try again.');
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

  if (done && newGameId) {
    return (
      <CompletionScreen
        icon="check"
        title="Game posted!"
        description="Your game is live — players can now join."
        actions={[
          { label: 'View game', variant: 'outline', onClick: () => onNavigate('game-details', { id: newGameId }) },
          { label: 'Invite players', variant: 'dark', onClick: () => onNavigate('invite-players', { id: newGameId }) },
        ]}
      />
    );
  }

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
              <div className="lbl mb-0!">Court</div>
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className={`chip ${userLoc ? 'lime' : ''}`}
                aria-pressed={!!userLoc}
              >
                <Icon name={locating ? 'spinner' : 'navigate'} size={12} className={locating ? 'animate-spin' : ''} />
                {locating ? 'Locating…' : userLoc ? 'Nearest first' : 'Near me'}
              </button>
            </div>

            {locError && (
              <div className="text-[12px] text-[var(--coral)] font-semibold mb-2 flex items-center gap-1.5">
                <Icon name="location" size={13} /> {locError}
              </div>
            )}

            {/* Search — find a preferred venue by name/area, not just nearby ones */}
            {!venuesLoading && venues.length > 0 && (
              <div className="relative mb-3">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                  <Icon name="search" size={16} />
                </span>
                <input
                  className="control pl-10!"
                  placeholder="Search a venue by name or area"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  aria-label="Search venues"
                />
                {venueQuery && (
                  <button
                    type="button"
                    onClick={() => setVenueQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Map — see the nearest courts; tap a pin to pick one */}
            {!venuesLoading && mapPoints.length > 0 && (
              <div className="relative z-0 h-[200px] rounded-2xl overflow-hidden border-[0.5px] border-[var(--hairline)] mb-3">
                <MapContainer center={mapCenter} zoom={12} className="w-full h-full" zoomControl={false} scrollWheelZoom={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={fitPoints} />
                  {userLoc && (
                    <CircleMarker
                      center={userLoc}
                      radius={8}
                      pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0040e0', fillOpacity: 1 }}
                    />
                  )}
                  {selectedCoords && (
                    <CircleMarker
                      center={selectedCoords}
                      radius={16}
                      pathOptions={{ color: '#C1F100', weight: 3, fillColor: '#C1F100', fillOpacity: 0.25 }}
                    />
                  )}
                  {locatable.map(({ v, coords, distanceKm }) => {
                    const photo = venueImage(v);
                    return (
                      <Marker
                        key={v.id}
                        position={coords}
                        icon={markerIcon}
                        eventHandlers={{ click: () => selectVenue(v.id) }}
                      >
                        <Popup className="venue-popup" minWidth={208} maxWidth={208}>
                          <button type="button" className="venue-popup-card" onClick={() => selectVenue(v.id)}>
                            <div
                              className="venue-popup-img"
                              style={photo ? { backgroundImage: `url(${photo})` } : undefined}
                            >
                              {!photo && <Icon name="paddle" size={26} />}
                            </div>
                            <div className="venue-popup-body">
                              <div className="venue-popup-title">{v.displayName}</div>
                              <div className="venue-popup-meta">
                                {distanceKm != null && (
                                  <>
                                    <span className="font-extrabold text-[var(--primary)]">{formatDistance(distanceKm)}</span>
                                    <span className="opacity-40">·</span>
                                  </>
                                )}
                                <span className="truncate min-w-0">{locationLine(v) || 'Court'}</span>
                              </div>
                              <div className="venue-popup-foot">
                                <span className="venue-popup-cta">
                                  {venueId === v.id ? 'Selected ✓' : 'Select court'}
                                </span>
                              </div>
                            </div>
                          </button>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            )}

            {/* Court list — photo + distance, nearest first */}
            {venuesLoading ? (
              <LoadingSkeleton variant="card" count={3} />
            ) : venues.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold py-2">
                No courts available right now — you can still post and add a court later.
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold py-3 text-center">
                No venues match “{venueQuery.trim()}”. Try a different name or area.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
                {filtered.map(({ v, distanceKm }) => {
                  const photo = venueImage(v);
                  const selected = venueId === v.id;
                  const meta = [distanceKm != null ? formatDistance(distanceKm) : null, locationLine(v) || (v.courtCount ? `${v.courtCount} courts` : 'Court')]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <button
                      key={v.id}
                      onClick={() => selectVenue(v.id)}
                      className={`time-pick text-left px-3! py-2.5! flex items-center gap-3 ${
                        selected ? 'bg-[var(--ink)]! text-white!' : 'bg-[var(--surface)]! text-[var(--ink)]!'
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
                      {selected && <Icon name="check" size={16} />}
                    </button>
                  );
                })}
              </div>
            )}
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
                <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Posting…
              </>
            ) : (
              <>
                <Icon name="bolt" size={18} /> Post game
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
