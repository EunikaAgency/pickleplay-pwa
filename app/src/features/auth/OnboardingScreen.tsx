import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { FormTierPicker } from '../../shared/components/forms/FormTierPicker';
import { FormField } from '../../shared/components/forms/FormField';
import { AddressAutocomplete } from '../../shared/components/forms/AddressAutocomplete';
import { duprForTier, skillTiers, type SkillTier } from '../../shared/lib/skillTiers';
import { useAuthStore } from '../../shared/lib/authStore';
import { getCurrentLocation } from '../../shared/lib/geo';
import { reverseGeocode, suggestPlaces, type GeocodeSuggestion } from '../../shared/lib/api';

interface OnboardingScreenProps {
  onComplete: () => void;
}

/** The pieces of a resolved place we persist on the account. */
interface ResolvedPlace {
  city?: string;
  province?: string;
  zipcode?: string;
  lat?: number;
  lng?: number;
}

/** The same postal-address shape `EditProfileScreen` edits, so what's captured
 *  here lands prefilled there. Every geocode path already carries coordinates —
 *  saving them is what lets the profile map open on the pin. */
interface PlaceParts {
  city: string | null;
  region: string | null;
  line1: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
}

const placeLabel = (city: string | null, region: string | null): string =>
  [city, region].filter(Boolean).join(', ');

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  // The geocoded place behind `location`. Null while the user is typing — the
  // text alone isn't a place until we resolve it (on locate, or on Continue).
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [tier, setTier] = useState<SkillTier['id'] | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Remember onboarding on the account (so the user is never re-onboarded),
  // saving the skill tier and the address they gave, then leave the flow.
  // `completeOnboarding` is best-effort, so we always proceed via onComplete.
  const finish = async (chosenTier: SkillTier['id'] | null) => {
    if (finishing) return;
    setFinishing(true);
    const tierName = chosenTier ? skillTiers.find((t) => t.id === chosenTier)?.name : undefined;
    await completeOnboarding({
      ...(chosenTier ? { skillLevel: duprForTier(chosenTier), skillLevelLabel: tierName } : {}),
      ...(place ?? {}),
      ...(address1.trim() ? { address1: address1.trim() } : {}),
      ...(address2.trim() ? { address2: address2.trim() } : {}),
    });
    onComplete();
  };

  // One resolved place → the fields, for all three entry points. Mirrors
  // `EditProfileScreen`'s `applyDetected`: a field is only touched when the
  // geocoder actually resolved a value, and address line 2 (unit / landmark) is
  // never auto-filled — no geocoder knows it.
  const applyPlace = (parts: PlaceParts, fallbackLabel: string) => {
    setLocation(placeLabel(parts.city, parts.region) || fallbackLabel);
    setPlace({
      city: parts.city ?? undefined,
      province: parts.region ?? undefined,
      zipcode: parts.postcode ?? undefined,
      lat: parts.lat,
      lng: parts.lng,
    });
    if (parts.line1) setAddress1(parts.line1);
    setLocError(null);
  };

  // Real coordinates from the device, reverse-geocoded into an address we can
  // save. `getCurrentLocation` already rejects with user-facing copy.
  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    setLocError(null);
    try {
      const [lat, lng] = await getCurrentLocation();
      const hit = await reverseGeocode(lat, lng);
      if (!hit) throw new Error("We couldn't work out your city. Type it below instead.");
      applyPlace(hit, hit.label);
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Couldn't get your location. Type your city below.");
    } finally {
      setLocating(false);
    }
  };

  const editLocation = (value: string) => {
    setLocation(value);
    setPlace(null); // what they typed no longer matches the resolved place
    setLocError(null);
  };

  // A picked suggestion is already geocoded, so Continue needs no lookup. This
  // runs after the field's own onChange (which cleared `place`), so it wins —
  // and it trims the geocoder's long label down to "City, Province".
  const pickSuggestion = (s: GeocodeSuggestion) => applyPlace(s, s.label);

  // Locating and picking resolve the place up front; typing free text doesn't —
  // so resolve it here. Resolving only reveals the address fields; the next
  // Continue advances. A geocoder miss or outage keeps the raw text as the city
  // rather than trapping the user behind a gate they can't clear.
  const continueFromLocation = async () => {
    if (resolving) return;
    if (place) {
      setStep(3);
      return;
    }
    const q = location.trim();
    if (!q) return;
    setResolving(true);
    setLocError(null);
    try {
      const [hit] = await suggestPlaces(q, { country: 'ph', limit: 1 });
      if (hit) applyPlace({ ...hit, city: hit.city ?? q }, q);
      else setPlace({ city: q });
    } catch {
      setPlace({ city: q });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="scroll flex flex-col pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(28px+env(safe-area-inset-bottom))] bg-[radial-gradient(900px_500px_at_90%_-10%,rgba(0,64,224,0.18),transparent_60%),radial-gradient(600px_400px_at_0%_110%,rgba(193,241,0,0.25),transparent_60%),var(--bg)]">
      <div className="px-5 flex flex-col flex-1 min-h-0">
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-[5px] rounded-[3px] transition-all duration-300 ease-out ${
                s <= step ? 'w-7 bg-[var(--lime)]' : 'w-2 bg-[var(--surface-3)]'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-center py-6">
        {step === 1 && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[var(--lime)] text-[var(--lime-ink)] inline-flex items-center justify-center shadow-[var(--shadow-fab)] mb-2">
              <Icon name="paddle" size={40} />
            </div>
            <h1 className="hd-1">Welcome to PickleBallers</h1>
            <p className="t-sm max-w-[320px]">
              The easiest way to find games, meet players, and organize play near you.
            </p>
            <Button fullWidth onClick={() => setStep(2)}>
              Get started <Icon name="forward" size={16} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--primary-tint)] text-[var(--primary)] inline-flex items-center justify-center mb-3">
                <Icon name="location" size={36} />
              </div>
              <h1 className="hd-1">Where do you play?</h1>
              <p className="t-sm max-w-[320px] mx-auto mt-2">
                We'll show you courts and games near you. You can change this any time.
              </p>
            </div>

            <Button
              variant="outline"
              fullWidth
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={16} />
                  </span>
                  Locating…
                </>
              ) : (
                <>
                  <Icon name="navigate" size={16} />
                  Use my current location
                </>
              )}
            </Button>

            <AddressAutocomplete
              value={location}
              placeholder="Search your city or area…"
              suppressSuggestions={place !== null}
              onChange={editLocation}
              onSelect={pickSuggestion}
            />

            {locError && (
              <p className="t-sm text-[var(--coral)] text-center m-0!">{locError}</p>
            )}

            {/* Only worth asking once we know the city — same fields, labels and
                placeholders as EditProfileScreen, so this lands prefilled there. */}
            {place && (
              <>
                <FormField
                  label="Address line 1"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  leadingIcon="location"
                  placeholder="House / street"
                />
                <FormField
                  label="Address line 2"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="Barangay, unit, landmark (optional)"
                />
              </>
            )}

            <Button
              fullWidth
              onClick={continueFromLocation}
              disabled={!location.trim() || locating || resolving}
            >
              {resolving ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={16} />
                  </span>
                  Checking…
                </>
              ) : (
                <>
                  Continue <Icon name="forward" size={16} />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--coral-soft)] text-[var(--coral)] inline-flex items-center justify-center mb-3">
                <Icon name="star" size={36} />
              </div>
              <h1 className="hd-1">How would you describe your game?</h1>
              <p className="t-sm max-w-[340px] mx-auto mt-2">
                Pick the tier that sounds like you. We'll match you with the right games — you can change it any time.
              </p>
            </div>

            <FormTierPicker value={tier} onChange={setTier} />

            <button
              type="button"
              onClick={() => setDuprOpen(true)}
              className="inline-flex items-center gap-1.5 text-[var(--primary)] font-bold text-[13px] self-center"
            >
              <Icon name="help" size={14} /> What does this mean?
            </button>

            <Button
              fullWidth
              onClick={() => finish(tier)}
              disabled={!tier || finishing}
            >
              {finishing ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={18} />
                  </span>
                  Setting up…
                </>
              ) : (
                <>
                  <Icon name="bolt" size={18} /> Let's play!
                </>
              )}
            </Button>
          </div>
        )}
        </div>
      </div>

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
