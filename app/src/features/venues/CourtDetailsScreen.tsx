import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { MembershipSheet } from './MembershipSheet';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import type { Navigate } from '../../shared/lib/navigation';
import { apiImageUrl, getVenue, listGames, listVenueCoaches, joinVenueMembership, leaveVenueMembership, respondToVenueMembershipInvite, subscribeToPlan, getVenueConversation, listPublicPlans, listSlotOverrides, getHours, submitCoachApplication, getMyCoachApplicationForVenue, cancelCoachApplication, submitOrganizerApplication, getMyOrganizerApplicationForVenue, cancelOrganizerApplication, ApiError, type ApiVenueDetail, type ApiGame, type ApiCoach, type ApiSubscriptionPlan, type OwnerHourEntry, type SlotPriceOverride } from '../../shared/lib/api';
import { useDemandTracking } from '../../shared/hooks/useDemandTracking';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { onRealtime } from '../../shared/lib/realtimeBus';
import {
  indoorLabel, priceRangeLabel, currencySymbol, locationLine, venueAmenities,
  mapsUrl, venueImage, venueCoords,
} from '../../shared/lib/venueDisplay';
import { getInitials } from '../../shared/lib/initials';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import { getCurrentLocation, haversineKm, formatDistance } from '../../shared/lib/geo';
import { resolveHourlyRate } from '../../shared/lib/pricing';
import { todayYMD } from '../bookings/bookingDisplay';

interface CourtDetailsScreenProps {
  courtId: string;
  /** 'lobby' = booking this court should hand back to create-game afterwards. */
  intent?: 'lobby';
  /** Date from the map filter (YYYY-MM-DD) — when set, courts show availability badges. */
  filterDate?: string;
  /** Start hour from the map filter (0-23) — when set, courts show availability badges. */
  filterStartHour?: number;
  /** End hour from the map filter (0-23) — pre-fills the booking end time. */
  filterEndHour?: number;
  onNavigate: Navigate;
  onBack: () => void;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// Display order for the weekly hours card (week starts Monday, reads naturally).
const WEEK: { key: string; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];
const HERO_GRADIENT = 'linear-gradient(135deg,#4d6dff 0%,#0040e0 60%,#0035be 100%)';
const SAVED_KEY = 'pb-saved-venues';

// Leaflet's default marker asset paths break under bundlers, so point them at the
// CDN copies (same approach as NearbyScreen's map).
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// --- Small game-row formatters (kept local; the venues slice must not import the
// games slice's gameDisplay.ts — cross-feature code only travels via shared/). ---

/** The date "thumb" (e.g. SAT / 15) from a game's date, falling back to its label. */
function gameThumb(g: ApiGame): { day: string; num: string } {
  if (g.date) {
    const d = new Date(`${g.date}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), num: String(d.getDate()) };
    }
  }
  return { day: (g.whenLabel || 'TBD').slice(0, 3).toUpperCase(), num: '' };
}

function gameTitle(g: ApiGame): string {
  if (g.title && g.title.trim()) return g.title.trim();
  if (g.gameType) return `${g.gameType[0].toUpperCase()}${g.gameType.slice(1)} game`;
  return 'Pickleball game';
}

function gameSpots(g: ApiGame): string {
  if (g.spotsLeft != null) return `${g.spotsLeft} spot${g.spotsLeft === 1 ? '' : 's'} left`;
  return g.skillLabel || g.durationLabel || '';
}

// --- Schedule / availability helpers (self-contained) ---

/** "14:00" → "2:00 PM". Inlined — the venues slice must not import bookings/bookingDisplay. */
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Local YYYY-MM-DD for "today" (matches how the API stores/compares dates). */
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2:00 PM" — the 12h label the Book screen's time prefill expects (to24h-parseable). */
function timeParam(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ampm}`;
}

/** "2 PM" — a compact chip label for an open hour. */
function hourCompact(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

/** Parse a "06:00 - 22:00" hours string into the bookable start-hour window. */
function parseDayRange(s?: string): { open: number; lastStart: number } | null {
  if (!s || /closed/i.test(s)) return null;
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = Number(m[1]);
  const closeH = Number(m[3]);
  const closeM = Number(m[4]);
  // A booking starting at `lastStart` ends within the closing time.
  const lastStart = closeM > 0 ? closeH : closeH - 1;
  if (lastStart < open) return null; // overnight/odd ranges fall back to the Book flow
  return { open, lastStart };
}

function readSavedVenues(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function CourtDetailsScreen({ courtId, intent, filterDate, filterStartHour, filterEndHour, onNavigate, onBack }: CourtDetailsScreenProps) {
  const { trackVenueView } = useDemandTracking();
  const [venue, setVenue] = useState<ApiVenueDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');

  // Fetch on mount (re-runs if courtId changes); state is only committed in the
  // async callbacks and skipped if the screen unmounted mid-flight.
  useEffect(() => {
    let cancelled = false;
    getVenue(courtId)
      .then((v) => {
        if (cancelled) return;
        setVenue(v);
        setStatus('ready');
        // Demand signal: a player (or guest) viewed this venue.
        trackVenueView(v.id);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [courtId, trackVenueView]);

  const retry = () => {
    setStatus('loading');
    getVenue(courtId)
      .then((v) => {
        setVenue(v);
        setStatus('ready');
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? 'notfound' : 'error');
      });
  };

  const loadingUI = (
    <div className="scroll safe-top safe-bottom px-4">
      <LoadingSkeleton variant="block" count={1} />
      <div className="mt-3">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    </div>
  );
  const errorUI = (
    <div className="scroll safe-top safe-bottom">
      <ErrorState
        title="Couldn't load this court"
        message="We couldn't reach the court directory. Try again in a moment."
        onRetry={retry}
      />
    </div>
  );
  const notFoundUI = (
    <div className="scroll safe-top safe-bottom">
      <EmptyState
        icon="location"
        title="Court not found"
        description="This court may have been removed. Try a different court nearby."
        action={{ label: 'Find another court', onPress: () => onNavigate('nearby') }}
      />
    </div>
  );

  // Real fetch state takes priority; DemoBranch only overrides for reviewer modes.
  const realState =
    status === 'loading' ? loadingUI : status === 'error' ? errorUI : status === 'notfound' ? notFoundUI : null;

  return (
    <DemoBranch loading={loadingUI} error={errorUI} empty={notFoundUI}>
      {realState ?? (venue && <CourtDetail venue={venue} intent={intent} filterDate={filterDate} filterStartHour={filterStartHour} filterEndHour={filterEndHour} onNavigate={onNavigate} onBack={onBack} />)}
    </DemoBranch>
  );
}

function CourtDetail({
  venue,
  intent,
  filterDate,
  filterStartHour,
  filterEndHour,
  onNavigate,
  onBack,
}: {
  venue: ApiVenueDetail;
  intent?: 'lobby';
  filterDate?: string;
  filterStartHour?: number;
  filterEndHour?: number;
  onNavigate: Navigate;
  onBack: () => void;
}) {
  const heroImage = venueImage(venue);
  const io = indoorLabel(venue);
  const courts = venue.courts ?? [];
  const courtsTotal = courts.length || venue.courtCount || 0;
  const price = priceRangeLabel(venue, courts);
  const location = locationLine(venue);
  const amenities = venueAmenities(venue);
  const about = venue.description || venue.oneLineSummary || '';
  // Platform-curated highlights — derived server-side from real venue data +
  // editorial, not owner-typed claims (see api computeVenueHighlights).
  const highlights = venue.curatedHighlights ?? { bestFor: [], whatPlayersLike: [] };
  const hasHighlights = highlights.bestFor.length > 0 || highlights.whatPlayersLike.length > 0;
  const coords = venueCoords(venue);
  const sym = currencySymbol(venue.pricingCurrency);

  // Per-court approval — a court set to 'manual' requires owner approval; anything
  // else confirms instantly. When there are no courts, fall back to the venue flag.
  const courtsList = venue.courts ?? [];
  const requireApproval = courtsList.length > 0
    ? courtsList.some((c) => c.approvalMode === 'manual')
    : !!venue.requireBookingApproval;
  const reviewCount = venue.googleReviewCount ?? null;

  const todayKey = DAY_KEYS[new Date().getDay()];
  const todayHours = venue.hours?.[todayKey];
  const hasHours = !!venue.hours && Object.keys(venue.hours).length > 0;

  // Pricing engine data — fetched so the price label and per-court rates reflect
  // time-block rates + slot overrides when a filter date/time is active.
  const [venueHours, setVenueHours] = useState<OwnerHourEntry[]>([]);
  const [overrides, setOverrides] = useState<SlotPriceOverride[]>([]);
  const effectiveDate = filterDate ?? todayYMD();

  useEffect(() => {
    let alive = true;
    getHours(venue.id)
      .then((rows) => { if (alive) setVenueHours(rows); })
      .catch(() => { if (alive) setVenueHours([]); });
    return () => { alive = false; };
  }, [venue.id]);

  useEffect(() => {
    if (!effectiveDate) { setOverrides([]); return; }
    let alive = true;
    listSlotOverrides(venue.id, effectiveDate)
      .then((rows) => { if (alive) setOverrides(rows); })
      .catch(() => { if (alive) setOverrides([]); });
    return () => { alive = false; };
  }, [venue.id, effectiveDate]);

  // Helper: resolve the effective price label when a date/time filter is active,
  // otherwise fall back to the static priceRangeLabel.
  function effectivePriceLabel(): string | null {
    if (filterDate != null && filterStartHour != null) {
      const startTime = `${String(filterStartHour).padStart(2, '0')}:00`;
      const resolved = courts.map((c) => resolveHourlyRate({
        venue, court: c, hours: venueHours, overrides,
        date: filterDate, startTime,
        isMember: venue.viewerIsMember ?? false,
      }).rate);
      if (resolved.length > 0) {
        const min = Math.min(...resolved);
        const max = Math.max(...resolved);
        return min === max ? `${sym}${min}/hr` : `${sym}${min}–${sym}${max}/hr`;
      }
    }
    return price;
  }

  // Gallery photos (resolved to absolute URLs, junk dropped). The hero already
  // shows the primary, so drop it from the strip to avoid showing it twice.
  const gallery = (venue.gallery ?? []).map((u) => apiImageUrl(u)).filter(Boolean);
  const galleryStrip = heroImage ? gallery.filter((u) => u !== heroImage) : gallery;
  const showGallery = galleryStrip.length > 0;

  const tags = [io, courtsTotal ? `${courtsTotal} courts` : null, price].filter(Boolean) as string[];

  // Saved (device-local favourite) + share state.
  const [saved, setSaved] = useState(() => readSavedVenues().includes(venue.id));
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  // Venue membership, persisted server-side (VenueMember). Seeded from the venue
  // detail's viewer fields so a returning member sees their plan; joining/cancelling
  // hits the self-service membership endpoints. Members surface in the owner's
  // Members tab and get member pricing at checkout.
  //
  // A membership with a future expiresAt (or null = perpetual) is "active" and the
  // button is hidden entirely. Once expired, the button reappears as "Renew
  // Subscription" so the player can extend it.
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [membershipPlanId, setMembershipPlanId] = useState<string | null>(
    () => venue.viewerMembershipTier ?? (venue.viewerIsMember ? 'member' : null),
  );
  const [membershipOpen, setMembershipOpen] = useState(false);
  const isMember = membershipPlanId != null;
  const membershipExpiresAt = venue.viewerMembershipExpiresAt ?? null;
  const isExpired = isMember && membershipExpiresAt != null && new Date(membershipExpiresAt) <= new Date();

  // Guests can't hold a membership — send them to sign in first. Logged-in
  // players open the plan chooser. When renewing, the sheet opens in renewal mode
  // (the existing plan is pre-selected but the CTA says "Renew").
  // When mode='invite', the player is accepting a pending membership invite.
  const [membershipMode, setMembershipMode] = useState<'join' | 'invite'>('join');
  const openMembership = (mode: 'join' | 'invite' = 'join') => {
    if (!isLoggedIn) { onNavigate('login'); return; }
    setMembershipMode(mode);
    setMembershipOpen(true);
  };

  const joinMembership = (planId: string) => {
    const prev = membershipPlanId;
    // Optimistic: use the plan *name* so it matches viewerMembershipTier
    // (the API stores plan.name as the VenueMember tier).  After a page
    // reload the sheet's planByRef() can match either id or name.
    const planName = apiPlans?.find((p) => p.id === planId)?.name ?? planId;
    setMembershipPlanId(planName); // optimistic — the sheet shows success right away
    // When the venue has API plans, use subscribeToPlan so the VenueMember tier
    // is the plan name (e.g. "Monthly") instead of the plan ObjectId. Falls back
    // to joinVenueMembership for venues without API plans.
    if (apiPlans && apiPlans.length > 0) {
      subscribeToPlan(planId).catch(() => setMembershipPlanId(prev));
    } else {
      joinVenueMembership(venue.id, planId).catch(() => setMembershipPlanId(prev));
    }
  };
  const cancelMembership = () => {
    const prev = membershipPlanId;
    setMembershipPlanId(null);
    setMembershipOpen(false);
    leaveVenueMembership(venue.id).catch(() => setMembershipPlanId(prev));
  };

  // Pending invite — the owner invited this player to the membership. The player
  // can accept (with an optional plan choice) or decline. Shown as a banner above
  // the CTA bar; tapping "Accept" opens the plan picker (same as Join Membership).
  // Tracked as local state so it can be cleared when the invite is removed
  // server-side (owner cancels before the player responds).
  const [hasPendingInvite, setHasPendingInvite] = useState(
    () => venue.viewerPendingMembershipTier !== undefined && venue.viewerPendingMembershipTier !== null,
  );
  // Listen for the owner removing the invite while the player is on this page —
  // the backend sends a venue_membership_removed notification via SSE.
  useEffect(() => onRealtime('notification', (p: any) => {
    if (p?.type === 'venue_membership_removed') setHasPendingInvite(false);
  }), []);
  const acceptInvite = (planId: string) => {
    // Look up the plan name so the VenueMember tier shows "Monthly" etc., not the ObjectId.
    const plan = apiPlans?.find((p) => p.id === planId);
    const tier = plan?.name || planId;
    setHasPendingInvite(false);
    setMembershipPlanId(planId);
    respondToVenueMembershipInvite(venue.id, true, tier).catch(() => {
      setMembershipPlanId(null);
      setHasPendingInvite(true);
    });
  };
  const declineInvite = () => {
    setHasPendingInvite(false);
    respondToVenueMembershipInvite(venue.id, false).catch(() => setHasPendingInvite(true));
  };

  // Fetch the venue's active API subscription plans so the sheet renders the
  // owner's real plans. When the venue has none, the sheet shows an empty state
  // and the "Join Membership" button is hidden.
  const [apiPlans, setApiPlans] = useState<ApiSubscriptionPlan[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listPublicPlans(venue.id)
      .then((rows) => { if (!cancelled) setApiPlans(rows); })
      .catch(() => { /* keep fallback plans */ });
    return () => { cancelled = true; };
  }, [venue.id]);

  // Match a membership tier ref (plan name or ObjectId) to an API plan so the
  // membership badge can show the human-readable plan name. Falls back to the
  // raw ref when apiPlans hasn't loaded yet.
  const planByRef = (ref: string | null | undefined) =>
    apiPlans?.find((p) => p.id === ref || p.name === ref);

  // ── Coaches here — everyone the owner approved to coach at this venue.
  // Public (like "Games here"), so guests see it too. Silent on failure: a
  // missing coach list shouldn't blank out the rest of the venue page.
  const [venueCoaches, setVenueCoaches] = useState<ApiCoach[]>([]);
  useEffect(() => {
    let cancelled = false;
    listVenueCoaches(venue.id)
      .then((rows) => { if (!cancelled) setVenueCoaches(rows); })
      .catch(() => { /* section just stays hidden */ });
    return () => { cancelled = true; };
  }, [venue.id]);

  // ── Partner applications (become a coach / organiser here) ──────────
  // Player-only: owners/staff lack player.dashboard.access and never see the
  // section. Statuses drive the button state (apply → pending → approved).
  const canApplyPartner = isLoggedIn && userHasPermission(currentUser, 'player.dashboard.access');
  const [coachApp, setCoachApp] = useState<{ id: string; status: string } | null>(null);
  const [orgApp, setOrgApp] = useState<{ id: string; status: string } | null>(null);
  const [applyBusy, setApplyBusy] = useState<'' | 'coach' | 'organizer'>('');
  // Which partner application the user is confirming a cancel for — drives an
  // in-app confirmation sheet instead of a native window.confirm().
  const [confirmCancel, setConfirmCancel] = useState<'' | 'coach' | 'organizer'>('');
  useEffect(() => {
    if (!canApplyPartner) return;
    let cancelled = false;
    getMyCoachApplicationForVenue(venue.id)
      .then((a) => { if (!cancelled) setCoachApp(a ? { id: a.id, status: a.status } : null); })
      .catch(() => { /* section still renders with Apply enabled */ });
    getMyOrganizerApplicationForVenue(venue.id)
      .then((a) => { if (!cancelled) setOrgApp(a ? { id: a.id, status: a.status } : null); })
      .catch(() => { /* ditto */ });
    return () => { cancelled = true; };
  }, [venue.id, canApplyPartner]);

  const applyPartner = async (kind: 'coach' | 'organizer') => {
    setApplyBusy(kind);
    try {
      if (kind === 'coach') {
        const res = await submitCoachApplication(venue.id);
        setCoachApp({ id: res.id, status: 'pending' });
      } else {
        const res = await submitOrganizerApplication(venue.id);
        setOrgApp({ id: res.id, status: 'pending' });
      }
    } catch (e) {
      // Already applied (409) — reflect the existing application instead of erroring.
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        const refresh = kind === 'coach' ? getMyCoachApplicationForVenue : getMyOrganizerApplicationForVenue;
        const set = kind === 'coach' ? setCoachApp : setOrgApp;
        refresh(venue.id).then((a) => set(a ? { id: a.id, status: a.status } : null)).catch(() => {});
        return;
      }
      // Applying is a paid capability (402). Send them to the subscribe screen
      // rather than failing silently — this is the intended upsell path.
      if (e instanceof ApiError && e.code === 'SUBSCRIPTION_REQUIRED') {
        onNavigate('coach-subscribe');
      }
    } finally {
      setApplyBusy('');
    }
  };

  // Withdraw a pending application (tap the pending row).
  const cancelPartner = async (kind: 'coach' | 'organizer') => {
    const app = kind === 'coach' ? coachApp : orgApp;
    if (!app || app.status !== 'pending') return;
    setApplyBusy(kind);
    try {
      if (kind === 'coach') { await cancelCoachApplication(app.id); setCoachApp(null); }
      else { await cancelOrganizerApplication(app.id); setOrgApp(null); }
    } catch {
      // ApiError (already decided / gone) — refresh the real state.
      const refresh = kind === 'coach' ? getMyCoachApplicationForVenue : getMyOrganizerApplicationForVenue;
      const set = kind === 'coach' ? setCoachApp : setOrgApp;
      refresh(venue.id).then((a) => set(a ? { id: a.id, status: a.status } : null)).catch(() => {});
    } finally {
      setApplyBusy('');
    }
  };

  // Button copy per application status. removed/rejected stay tappable —
  // the player can re-apply (the API re-opens the same application row) — and
  // pending stays tappable to CANCEL the application.
  const partnerReapplySub = (status: string | null) => {
    if (status === 'rejected') return "Your last application wasn't approved — apply again anytime";
    if (status === 'removed') return 'Partnership ended — you can re-apply';
    return null;
  };

  // Best-effort distance: if the device already granted location (or grants it
  // now), show how far the venue is. Silent on denial — it's a nicety.
  useEffect(() => {
    if (!coords) return;
    let alive = true;
    getCurrentLocation()
      .then((me) => { if (alive) setDistanceKm(haversineKm(me, coords)); })
      .catch(() => { /* no location — just omit the distance */ });
    return () => { alive = false; };
  }, [venue.id, coords]);

  const toggleSave = () => {
    const cur = readSavedVenues();
    const next = cur.includes(venue.id) ? cur.filter((x) => x !== venue.id) : [...cur, venue.id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(venue.id));
  };

  const share = async () => {
    const url = `${window.location.origin}/venues/${venue.slug || venue.id}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: venue.displayName, text: `Check out ${venue.displayName} on PickleBallers`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied');
      setTimeout(() => setShareMsg(null), 2000);
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  };

  // Open a venue-scoped conversation with the venue owner. Guests are routed
  // to login; logged-in owners don't see this (can't message themselves).
  const messageVenue = async () => {
    if (!currentUser) { onNavigate('login'); return; }
    setMessageLoading(true);
    try {
      const conv = await getVenueConversation(venue.id);
      onNavigate('chat', { id: conv.id, name: conv.contextLabel ?? 'Venue' });
    } catch {
      /* network or the venue has no owner — silent, the button is disabled */
    } finally {
      setMessageLoading(false);
    }
  };
  const isOwner = currentUser && venue.ownerUserId && String(currentUser.id) === String(venue.ownerUserId);

  // Real games hosted at this venue (published = joinable). Read-only surface of
  // already-public game browse, so no new permission gates it.
  const [games, setGames] = useState<ApiGame[]>([]);
  const [gamesStatus, setGamesStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const [prevVenueId, setPrevVenueId] = useState(venue.id);
  if (venue.id !== prevVenueId) {
    setPrevVenueId(venue.id);
    setGamesStatus('loading');
  }

  useEffect(() => {
    let cancelled = false;
    listGames({ venueId: venue.id })
      .then((list) => {
        if (cancelled) return;
        setGames(list.slice(0, 4));
        setGamesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setGamesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [venue.id]);

  // Today's open slots (live free-court count, bounded by opening hours).
  const today = localToday();
  const avail = useVenueAvailability(venue.id, today);
  const todayClosed = !!todayHours && /closed/i.test(todayHours);
  const range = parseDayRange(todayHours);

  // When arriving from the map filter, check venue-level availability for the chosen date+time
  // so we can badge courts as Available / Fully booked.
  const filterAvail = useVenueAvailability(venue.id, filterDate || '');
  const filterHasAvail = filterDate != null && filterStartHour != null
    ? !filterAvail.isFull(filterStartHour) && filterAvail.availability != null
    : null;
  const freeHours: number[] = [];
  if (range) {
    for (let h = Math.max(range.open, avail.minBookableHour); h <= range.lastStart; h++) {
      if (!avail.startDisabled(h)) freeHours.push(h);
    }
  }
  const SLOT_CAP = 12;
  const slotChips = freeHours.slice(0, SLOT_CAP);

  // Booking params — include filter date/time when arriving from the map filter.
  const bookParams: Record<string, unknown> = { venueId: venue.id, intent };
  if (filterDate && filterStartHour != null) {
    bookParams.date = filterDate;
    bookParams.time = to12h(`${String(filterStartHour).padStart(2, '0')}:00`);
    if (filterEndHour != null && filterEndHour > filterStartHour) {
      bookParams.hours = filterEndHour - filterStartHour;
    }
  }

  const ctaLabel = intent === 'lobby'
    ? 'Book & set up lobby'
    : requireApproval ? 'Request to book' : 'Book this court';

  return (
    <div className="scroll pb-[130px]">
      <div className="detail-hero">
        <div
          className="img"
          style={heroImage ? { background: `url(${heroImage}) center/cover` } : { background: HERO_GRADIENT }}
        />
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2 items-center">
            {shareMsg && (
              <span className="text-[11px] font-bold text-white bg-black/55 rounded-full px-2.5 py-1">{shareMsg}</span>
            )}
            <button className="icon-btn" aria-label="Share this court" onClick={share}>
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" aria-label={saved ? 'Remove from saved' : 'Save this court'} aria-pressed={saved} onClick={toggleSave}>
              <Icon name={saved ? 'heart' : 'heart_o'} size={16} className={saved ? 'text-[var(--coral)]' : ''} />
            </button>
          </div>
        </div>
        <div className="info">
          {(tags.length > 0 || venue.isVerified) && (
            <div className="tag-row">
              {tags.map((t, i) => (
                <span key={t} className={`tag ${i === 0 ? 'lime' : ''}`}>
                  {t}
                </span>
              ))}
              {venue.isVerified && (
                <span className="tag inline-flex items-center gap-1">
                  <Icon name="verified" size={11} /> Verified
                </span>
              )}
            </div>
          )}
          <h1>{venue.displayName}</h1>
          {(venue.googleRating != null || location || venue.fullAddress) && (
            <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
              {venue.googleRating != null && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="star" size={14} /> {venue.googleRating}
                  {reviewCount != null && reviewCount > 0 && ` · ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Icon name="location" size={14} /> {location || venue.fullAddress}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="detail-body">
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Price</div>
            <div className="val">{effectivePriceLabel() || '—'}</div>
            {(venue as any).pricingTaxLabel && <div className="t-sm mt-0.5 text-[var(--muted)]">{(venue as any).pricingTaxLabel}</div>}
            {venue.openPlayPrice != null && Number(venue.openPlayPrice) > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('open-play-book', { venueId: venue.id })}
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--lime-ink,var(--primary))]"
              >
                Join open play · {sym}{Number(venue.openPlayPrice)}/session <Icon name="chevron_right" size={14} />
              </button>
            )}
          </div>
          <div className="kv">
            <div className="eyebrow">Surface</div>
            <div className="val capitalize">{venue.surfaceType || '—'}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Today</div>
            <div className={`val ${todayHours && todayHours !== 'Closed' ? 'lime' : ''}`}>{todayHours || '—'}</div>
          </div>
        </div>

        {/* ── Active membership badge ──────────────────────────── */}
        {isMember && !isExpired && (
          <div className="mt-4 flex items-center gap-3 bg-[var(--lime-soft)] text-[var(--lime-ink)] rounded-[16px] px-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-[var(--lime-ink)] text-white inline-flex items-center justify-center shrink-0">
              <Icon name="card_membership" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px]">
                You're subscribed{membershipPlanId ? ` to ${planByRef(membershipPlanId)?.name ?? membershipPlanId}` : ''}
              </p>
              <p className="text-[12px] font-semibold opacity-80">
                {membershipExpiresAt
                  ? `Renews ${new Date(membershipExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Active — member pricing applied at checkout'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openMembership()}
              className="shrink-0 px-3 h-8 rounded-full text-[11px] font-bold bg-[var(--ink)] text-white"
            >
              Manage
            </button>
          </div>
        )}

        {/* Photos — the rest of the venue's gallery beyond the hero. */}
        {showGallery && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Photos</div>
            </div>
            <div className="scroll-x flex gap-2.5 -mx-1 px-1">
              {galleryStrip.map((src, i) => (
                <button
                  key={src + i}
                  className="shrink-0 w-[180px] h-[120px] rounded-[16px] overflow-hidden border-[0.5px] border-[var(--hairline)] active:scale-[0.98] transition-transform"
                  style={{ background: `url(${src}) center/cover` }}
                  aria-label={`Photo ${i + 1} of ${venue.displayName}`}
                  onClick={() => window.open(src, '_blank')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Open today — live availability, only on a bookable venue. */}
        {price && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div>
                <div className="t-eyebrow">Availability</div>
                <div className="hd-2 mt-1">Open today</div>
              </div>
              <button className="more" onClick={() => onNavigate('book-court', { venueId: venue.id, intent })}>
                Pick a date
              </button>
            </div>
            {todayClosed ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-4 text-center">
                Closed today — pick another day to book.
              </div>
            ) : !range ? (
              <Button fullWidth variant="outline" onClick={() => onNavigate('book-court', { venueId: venue.id, intent })}>
                <Icon name="clock" size={15} /> See available times
              </Button>
            ) : slotChips.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {slotChips.map((h) => (
                    <button
                      key={h}
                      className="chip"
                      onClick={() => onNavigate('book-court', { venueId: venue.id, date: today, time: timeParam(h), intent })}
                    >
                      {hourCompact(h)}
                    </button>
                  ))}
                  {freeHours.length > SLOT_CAP && (
                    <button className="chip" onClick={() => onNavigate('book-court', { venueId: venue.id, date: today, intent })}>
                      +{freeHours.length - SLOT_CAP} more
                    </button>
                  )}
                </div>
                <div className="text-[12px] text-[var(--muted)] font-semibold mt-2.5">
                  Tap a time to book it{avail.availability == null ? ' · checking live availability…' : ''}.
                </div>
              </>
            ) : (
              <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-4 text-center">
                No open slots left today — try another day.
              </div>
            )}
          </div>
        )}

        <div className="location-card">
          {coords ? (
            <div className="h-[140px] relative">
              <MapContainer
                center={coords}
                zoom={15}
                className="w-full h-full"
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                keyboard={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={coords} icon={markerIcon} />
              </MapContainer>
            </div>
          ) : (
            <div className="map-preview">
              <div className="pin">
                <Icon name="location" size={16} />
              </div>
            </div>
          )}
          <div className="map-info">
            <div className="text">
              <div className="name">{venue.displayName}</div>
              <div className="addr">{venue.fullAddress || location || '—'}</div>
              {distanceKm != null && (
                <div className="addr inline-flex items-center gap-1 text-[var(--primary)]! font-bold">
                  <Icon name="navigate" size={12} /> {formatDistance(distanceKm)} away
                </div>
              )}
            </div>
            <button
              className="directions"
              aria-label="Get directions"
              onClick={() => window.open(mapsUrl(venue), '_blank')}
            >
              <Icon name="directions" size={18} />
            </button>
          </div>
        </div>

        {about && (
          <div className="about-card">
            <div className="t-eyebrow mb-1.5">About this venue</div>
            <p>{about}</p>
          </div>
        )}

        {/* Highlights — platform-curated from real data + editorial, not owner claims. */}
        {hasHighlights && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Highlights</div>
            </div>
            {highlights.bestFor.length > 0 && (
              <div className="mb-3">
                <div className="t-eyebrow mb-1.5">Best for</div>
                <div className="flex flex-wrap gap-2">
                  {highlights.bestFor.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] px-3 py-1.5 text-[12.5px] font-semibold"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {highlights.whatPlayersLike.length > 0 && (
              <div>
                <div className="t-eyebrow mb-1.5">What players like</div>
                <div className="flex flex-wrap gap-2">
                  {highlights.whatPlayersLike.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink-2)] px-3 py-1.5 text-[12.5px] font-semibold"
                    >
                      <Icon name="check" size={12} className="text-[var(--lime-ink)]" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full weekly hours — collapsed to today, expandable. */}
        {hasHours && (
          <div className="section p-0!">
            <button
              className="section-head px-0 w-full"
              onClick={() => setHoursOpen((v) => !v)}
              aria-expanded={hoursOpen}
            >
              <div className="hd-2">Hours</div>
              <span className="more inline-flex items-center gap-1">
                {hoursOpen ? 'Hide' : 'All hours'}
                <Icon name="chevron" size={14} className={hoursOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
              </span>
            </button>
            <div className="bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] divide-y divide-[var(--hairline)]">
              {WEEK.filter((d) => hoursOpen || d.key === todayKey).map((d) => {
                const val = venue.hours?.[d.key];
                const isToday = d.key === todayKey;
                const closed = !val || /closed/i.test(val);
                return (
                  <div key={d.key} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                    <span className={`font-semibold ${isToday ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}>
                      {d.label}{isToday ? ' · Today' : ''}
                    </span>
                    <span className={`font-bold ${closed ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                      {val && !closed ? val : 'Closed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Amenities</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-3 py-2.5 text-[13px] text-[var(--ink-2)] font-semibold"
                >
                  <span className="w-[22px] h-[22px] rounded-lg bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="check" size={12} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-court breakdown — number, type, surface. */}
        {courts.length > 0 && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Courts</div>
              <span className="more">{courts.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {courts.map((c) => {
                const meta = [
                  c.indoor != null ? (c.indoor ? 'Indoor' : 'Outdoor') : null,
                  c.surfaceType ? c.surfaceType.charAt(0).toUpperCase() + c.surfaceType.slice(1) : null,
                ].filter(Boolean);
                const thumb = apiImageUrl(c.mainImageUrl);
                const photos = (c.galleryImageUrls ?? []).map((u) => apiImageUrl(u)).filter(Boolean) as string[];
                // This court's own hours for today (each court can keep its own schedule).
                const courtToday = c.hours?.[todayKey];
                const courtTodayLabel = courtToday
                  ? (/closed/i.test(courtToday) ? 'Closed today' : `Open today · ${courtToday.replace(' - ', '–')}`)
                  : null;
                // Owner-set "Court profile" attributes — only the ones that carry a value.
                const profile = [
                  c.floorType ? `${c.floorType} floor` : null,
                  c.ballType ? `${c.ballType} ball` : null,
                  c.spaceAroundCourt ? `${c.spaceAroundCourt} clearance` : null,
                  c.hasAircon ? 'Air-conditioned' : null,
                  c.highCeiling ? 'High ceiling' : null,
                  c.hasRefreshmentStand ? 'Refreshment stand' : null,
                ].filter(Boolean) as string[];
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {thumb ? (
                        <div className="w-11 h-11 rounded-[10px] shrink-0" style={{ background: `url(${thumb}) center/cover` }} />
                      ) : (
                        <div className="w-11 h-11 rounded-[10px] shrink-0 bg-[var(--primary-tint)] text-[var(--primary)] inline-flex items-center justify-center font-heading font-bold">
                          {c.courtNumber}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-[var(--ink)] truncate">
                          {c.courtName || `Court ${c.courtNumber}`}
                        </div>
                        {meta.length > 0 && (
                          <div className="text-[12px] text-[var(--muted)] font-semibold">{meta.join(' · ')}</div>
                        )}
                        {/* Availability badge from map date/time filter */}
                        {filterHasAvail != null && (
                          <span className={`court-avail-badge${filterHasAvail ? ' available' : ' booked'}`}>
                            {filterHasAvail ? 'Available' : 'Fully booked'}
                          </span>
                        )}
                        {courtTodayLabel && (
                          <div className={`text-[11.5px] font-semibold ${courtToday && !/closed/i.test(courtToday) ? 'text-[var(--lime-ink,var(--muted))]' : 'text-[var(--muted)]'}`}>{courtTodayLabel}</div>
                        )}
                      </div>
                    </div>
                    {c.description && (
                      <p className="text-[12.5px] text-[var(--muted)] leading-snug">{c.description}</p>
                    )}
                    {profile.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full border-[0.5px] border-[var(--hairline)] text-[var(--ink-2)] px-2.5 py-1 text-[11.5px] font-semibold"
                          >
                            <Icon name="check" size={11} className="text-[var(--lime-ink)]" />
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.isSplittable && (
                      <div className="text-[12px] font-semibold text-[var(--blue)]">
                        Splittable into {c.splitCount ?? 2} half-courts
                        {c.subUnitRates?.length ? (
                          <span className="text-[var(--muted)]">
                            {' · '}{c.subUnitRates.map((r) => `Half ${r.index + 1}: ${sym}${r.hourlyRate}/hr`).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {photos.length > 0 && (
                      <div className="scroll-x flex gap-2 -mx-1 px-1">
                        {photos.map((src, i) => (
                          <button
                            key={src + i}
                            type="button"
                            className="w-20 h-16 rounded-[10px] shrink-0 active:scale-[0.98] transition-transform"
                            style={{ background: `url(${src}) center/cover` }}
                            aria-label={`Photo ${i + 1} of ${c.courtName || `Court ${c.courtNumber}`}`}
                            onClick={() => window.open(src, '_blank')}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact — call, message, or visit the venue's site. */}
        {(venue.phone || venue.website || (venue.ownerUserId && !isOwner)) && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Contact</div>
            </div>
            <div className="flex flex-col gap-2">
              {/* Message the venue owner directly (replaces Messenger/IG DMs). */}
              {venue.ownerUserId && !isOwner && (
                <button
                  className="flex items-center gap-3 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-3 text-[14px] font-bold text-[var(--ink)] disabled:opacity-50"
                  onClick={messageVenue}
                  disabled={messageLoading}
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="chat" size={15} />
                  </span>
                  <span>{messageLoading ? 'Opening chat…' : 'Message venue'}</span>
                  <Icon name="forward" size={14} className="ml-auto text-[var(--muted)]" />
                </button>
              )}
              {venue.phone && (
                <a
                  href={`tel:${venue.phone}`}
                  className="flex items-center gap-3 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-3 text-[14px] font-bold text-[var(--ink)]"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="mic" size={15} />
                  </span>
                  {venue.phone}
                </a>
              )}
              {venue.website && (
                <a
                  href={/^https?:\/\//i.test(venue.website) ? venue.website : `https://${venue.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-3 text-[14px] font-bold text-[var(--ink)]"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="globe" size={15} />
                  </span>
                  <span className="truncate">Visit website</span>
                  <Icon name="forward" size={14} className="ml-auto text-[var(--muted)]" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Coaches here — the approved coaching roster. Tapping a row opens the
            coach's public profile (/coaches/:slug), same target as Find Coach. */}
        {venueCoaches.length > 0 && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div>
                <div className="t-eyebrow">Coaches here</div>
                <div className="hd-2 mt-1">Book a lesson at this venue</div>
              </div>
            </div>
            {/* Mirrors the home tab's friends rail: a scrolling row of round
                avatars with a name + sub-label under each. That rail's CSS is
                scoped to `.pb-v2.v2-home`, so this v1 screen re-creates the
                look with its own `scroll-x` idiom rather than reusing it. */}
            <div className="scroll-x flex gap-4 -mx-1 px-1 pb-1.5">
              {venueCoaches.map((coach) => {
                const photo = apiImageUrl(coach.avatarUrl || coach.imageUrl);
                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => onNavigate('coach-detail', { id: coach.slug || coach.id })}
                    className="shrink-0 w-[84px] flex flex-col items-center gap-1.5 text-center active:scale-[0.98] transition-transform"
                  >
                    <span className="avatar h-16 w-16 overflow-hidden rounded-full shadow-[var(--shadow-card)]">
                      {photo
                        ? <img src={photo} alt="" className="h-full w-full object-cover" />
                        : <span>{getInitials(coach.displayName)}</span>}
                    </span>
                    <span className="flex w-full items-center justify-center gap-0.5">
                      <span className="truncate text-[12px] font-bold leading-tight text-[var(--ink)]">{coach.displayName}</span>
                      {coach.isVerified && (
                        <span className="flex-none text-[var(--primary)]" title="Verified"><Icon name="verified" size={12} /></span>
                      )}
                    </span>
                    <span className="w-full truncate text-[11px] leading-tight text-[var(--muted)]">
                      {coach.specialty || 'Coach'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Partner with this venue — player-only apply entries (coach / organiser).
            Owners/staff lack player.dashboard.access and never see this. */}
        {canApplyPartner && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div>
                <div className="t-eyebrow">Partner with this venue</div>
                <div className="hd-2 mt-1">Coach or organise here</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {([
                { kind: 'coach' as const, icon: 'school', label: 'Become a coach', sub: 'Run clinics & lessons at this venue', status: coachApp?.status ?? null, noun: 'a coach' },
                { kind: 'organizer' as const, icon: 'trophy', label: 'Become an organizer', sub: 'Host tournaments & events here', status: orgApp?.status ?? null, noun: 'an organiser' },
              ]).map((row) => {
                const isPending = row.status === 'pending';
                const isApproved = row.status === 'approved';
                const reapplySub = partnerReapplySub(row.status);
                // Applying is a paid capability — the player must hold the matching live
                // partner subscription first (it's what proves a legit coach / organizer).
                // Show it disabled with a red "subscribe first" note rather than letting
                // them tap through to a 402. Only while they're actually free to apply.
                const needsSub = !isPending && !isApproved && (
                  row.kind === 'coach'
                    ? !currentUser?.coachSubscriptionActive
                    : !currentUser?.organizerSubscriptionActive
                );
                const subScreen = row.kind === 'coach' ? 'coach-subscribe' : 'organizer-subscribe';
                const subNote = row.kind === 'coach'
                  ? 'Subscribe as a coach first to apply here'
                  : 'Subscribe as an organizer first to apply here';
                const disabled = isApproved || applyBusy !== '' || needsSub;
                const mainLabel = applyBusy === row.kind
                  ? (isPending ? 'Cancelling…' : 'Sending application…')
                  : isPending ? row.label
                  : isApproved ? `You're ${row.noun} here`
                  : reapplySub ? 'Apply again'
                  : row.label;
                const subLabel = isPending ? 'Application pending — tap to cancel'
                  : isApproved ? 'Partnership active'
                  : reapplySub ?? row.sub;
                // Each entry is a distinct, always-visible card. A crisp solid
                // border (a fraction of --ink, so it flips correctly in dark
                // mode) does the heavy lifting for "obviously a card" — shadows
                // alone wash out on some displays; --shadow-card just adds lift.
                // Locked/approved states read from the lock icon + note / badge,
                // not from fading the whole card, so both cards stay legible.
                const cardClass = 'w-full flex items-center gap-3 bg-[var(--surface)] rounded-[16px] px-4 py-3.5 text-[14px] font-bold text-[var(--ink)] shadow-[var(--shadow-card)]';
                const cardStyle = { border: '1px solid color-mix(in srgb, var(--ink) 18%, transparent)' };
                return (
                  <div key={row.kind}>
                    {isPending ? (
                      // Pending: not tappable-to-cancel any more — an explicit
                      // "Cancel request" button sits beside the Pending badge, so
                      // the row is a plain card (can't nest a button in a button).
                      <div className={cardClass} style={cardStyle}>
                        <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center shrink-0">
                          <Icon name={row.icon} size={15} />
                        </span>
                        <span className="min-w-0 text-left">
                          <span className="block">{row.label}</span>
                          <span className="block text-[12px] font-medium text-[var(--muted)]">Application pending — waiting for the venue to approve</span>
                        </span>
                        <span className="ml-auto flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D] whitespace-nowrap">Pending</span>
                          <button
                            type="button"
                            onClick={() => { if (applyBusy === '') setConfirmCancel(row.kind); }}
                            disabled={applyBusy !== ''}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold text-[var(--coral)] border border-[var(--coral)] disabled:opacity-60 whitespace-nowrap"
                          >
                            {applyBusy === row.kind ? 'Cancelling…' : 'Cancel request'}
                          </button>
                        </span>
                      </div>
                    ) : (
                    <button
                      className={`${cardClass} disabled:cursor-default`}
                      style={cardStyle}
                      onClick={() => {
                        if (disabled) return;
                        void applyPartner(row.kind);
                      }}
                      disabled={disabled}
                    >
                      <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                        <Icon name={row.icon} size={15} />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block">{mainLabel}</span>
                        <span className="block text-[12px] font-medium text-[var(--muted)]">{subLabel}</span>
                      </span>
                      {isApproved && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#81C784] whitespace-nowrap">Approved</span>
                      )}
                      {needsSub && <Icon name="lock" size={14} className="ml-auto text-[var(--muted)]" />}
                      {!isApproved && !needsSub && <Icon name="forward" size={14} className="ml-auto text-[var(--muted)]" />}
                    </button>
                    )}
                    {needsSub && (
                      <button
                        type="button"
                        onClick={() => onNavigate(subScreen)}
                        className="mt-1.5 ml-1 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--coral)]"
                      >
                        <Icon name="lock" size={12} />
                        {subNote}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Games hosted at this venue — live from the games API (published = joinable). */}
        <div className="section p-0!">
          <div className="section-head px-0">
            <div>
              <div className="t-eyebrow">Games here</div>
              <div className="hd-2 mt-1">Drop in or RSVP</div>
            </div>
            {games.length > 0 && (
              <button className="more" onClick={() => onNavigate('games')}>All</button>
            )}
          </div>
          {gamesStatus === 'loading' ? (
            <LoadingSkeleton variant="card" count={2} />
          ) : gamesStatus === 'error' ? (
            <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-5 text-center">
              Couldn't load games for this court.
            </div>
          ) : games.length === 0 ? (
            <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-5 text-center">
              No games scheduled here yet.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {games.map((g) => {
                const thumb = gameThumb(g);
                const time = g.timeLabel || g.whenLabel || '';
                const spots = gameSpots(g);
                return (
                  <button
                    key={g.id}
                    className="game-row"
                    onClick={() => onNavigate('game-details', { id: g.id })}
                  >
                    <div className="thumb lime">
                      <span className="day">{thumb.day}</span>
                      {thumb.num && <span className="num">{thumb.num}</span>}
                    </div>
                    <div className="body">
                      <div className="title">{gameTitle(g)}</div>
                      <div className="meta">
                        {time && <span className="m"><Icon name="clock" size={11} />{time}</span>}
                        {spots && <span className="m"><Icon name="paddle" size={11} />{spots}</span>}
                      </div>
                    </div>
                    <div className="rsvp bg-[var(--primary-tint)]! text-[var(--primary)]! shadow-none!">
                      <Icon name="chevron" size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="app-action-bar app-action-bar--bare">
        {/* policy notes removed */}

        {/* ── Pending invite banner ──────────────────────────────── */}
        {hasPendingInvite && (
          <div className="mb-3 flex items-center gap-3 bg-[var(--lime-soft)] text-[var(--lime-ink)] rounded-[16px] px-4 py-3">
            <Icon name="card_membership" size={20} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[13px]">You've been invited to join the membership</p>
              <p className="text-[11px] font-semibold opacity-80">Accept and pick a plan to get started.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={declineInvite}
                className="px-3 h-8 rounded-full text-[11px] font-bold bg-white/30"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => openMembership('invite')}
                className="px-3 h-8 rounded-full text-[11px] font-bold bg-[var(--ink)] text-white"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {/* The lobby hand-off is a focused book-then-create flow — no membership CTA there. */}
        {intent === 'lobby' ? (
          <Button fullWidth onClick={() => onNavigate('book-court', bookParams)}>
            <Icon name="calendar" size={16} /> {ctaLabel}
          </Button>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {/* Membership button: hidden when the player has an active (non-expired)
                  membership — they're already a member. Shown as "Renew Subscription"
                  when expired, and "Join Membership" for non-members.
                  Also hidden when the player has a pending invite — the Accept banner above replaces it. */}
              {hasPendingInvite ? null : (!isMember || isExpired) && apiPlans && apiPlans.length > 0 ? (
                <Button
                  variant={isExpired ? 'brand' : 'outline'}
                  className={`flex-1 text-[15px] px-5 py-3.5 ${isExpired ? '' : 'shadow-[0_6px_18px_-8px_rgba(15,23,42,0.22)]'}`}
                  onClick={() => openMembership()}
                >
                  <Icon name={isExpired ? 'refresh' : 'star'} size={16} />
                  {isExpired ? 'Renew Subscription' : 'Join Membership'}
                </Button>
              ) : null}
              {effectivePriceLabel() ? (
                <Button
                  className="text-[15px] px-5 py-3.5 flex-1"
                  onClick={() => onNavigate('book-court', bookParams)}
                >
                  <Icon name="calendar" size={16} /> {ctaLabel}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 text-[15px] px-5 py-3.5 shadow-[0_6px_18px_-8px_rgba(15,23,42,0.22)]"
                  disabled
                >
                  <Icon name="lock" size={16} /> Unavailable
                </Button>
              )}
            </div>
            {!effectivePriceLabel() && (
              <div className="text-[12px] text-[var(--muted)] font-semibold mt-2 text-center">
                {apiPlans && apiPlans.length > 0
                  ? 'No rates listed for this court yet — membership still available.'
                  : 'No rates listed for this court yet.'}
              </div>
            )}
          </>
        )}
      </div>

      <MembershipSheet
        open={membershipOpen}
        onClose={() => setMembershipOpen(false)}
        venueName={venue.displayName}
        currency={sym}
        currentPlanId={membershipPlanId}
        isRenewal={isExpired || membershipMode === 'invite'}
        onJoin={membershipMode === 'invite' ? acceptInvite : joinMembership}
        onCancel={membershipMode === 'invite' ? declineInvite : cancelMembership}
        apiPlans={apiPlans}
      />

      {/* Cancel-application confirmation (replaces the native window.confirm). */}
      <BottomSheet
        open={confirmCancel !== ''}
        onClose={() => setConfirmCancel('')}
        title="Cancel this application?"
        flushFooter
        footer={
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setConfirmCancel('')}>Keep it</Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => { const k = confirmCancel; setConfirmCancel(''); if (k) void cancelPartner(k); }}
            >
              Yes, cancel
            </Button>
          </div>
        }
      >
        <p className="px-5 pb-2 text-[14px] text-[var(--ink-2)] leading-relaxed">
          This withdraws your {confirmCancel === 'organizer' ? 'organiser' : 'coach'} application at {venue.displayName}. You can apply again anytime.
        </p>
      </BottomSheet>

      {/* ── FAQs ── */}
      {venue.faqs && venue.faqs.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading font-bold text-[16px] text-[var(--ink)] mb-3 flex items-center gap-2">
            <Icon name="help" size={18} /> Frequently asked questions
          </h2>
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] divide-y-[0.5px] divide-[var(--hairline)] overflow-hidden">
            {venue.faqs.map((faq: any, i: number) => (
              <details key={faq.id ?? i} className="group">
                <summary className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer list-none select-none">
                  <span className="font-semibold text-[14px] text-[var(--ink)] flex-1">{faq.question}</span>
                  <Icon name="expand_more" size={18} className="text-[var(--muted)] transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-3.5 text-[14px] text-[var(--ink-2)] leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
