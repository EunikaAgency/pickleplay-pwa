import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { FormField } from '../../shared/components/forms/FormField';
import { useForm } from '../../shared/hooks/useForm';
import { OwnerSection } from './components/OwnerSection';
import { MapPinPicker } from './components/MapPinPicker';
import { AddressAutocomplete } from './components/AddressAutocomplete';
import { createVenue, fetchCities, reverseGeocode, ApiError, type ApiCity, type GeocodeSuggestion } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerNewVenueScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function OwnerNewVenueScreen({ onNavigate, onBack }: OwnerNewVenueScreenProps) {
  const [cities, setCities] = useState<ApiCity[]>([]);
  const [errMsg, setErrMsg] = useState('');
  // The place we auto-detected from the dropped pin / address (shown as
  // "Detected: …"), plus an in-flight flag while we reverse-geocode the pin.
  const [pinCity, setPinCity] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  // A point to fly the map to after the owner picks an address suggestion (the
  // map only recenters on a new flyTo target, not on lat/lng prop changes).
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCities()
      .then((c) => { if (!cancelled) setCities(c); })
      .catch(() => { /* cities optional; the form still works without them */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm({
    initial: {
      displayName: '',
      oneLineSummary: '',
      description: '',
      // City is a free-text field (auto-filled from the address). cityId silently
      // links a seeded city when the typed name matches one (so city filtering
      // still works); region holds the detected province.
      cityName: '',
      cityId: '',
      region: '',
      fullAddress: '',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      lat: '',
      lng: '',
      phone: '',
      email: '',
      website: '',
    },
    validators: {
      displayName: (v) => (!String(v ?? '').trim() || String(v).trim().length < 2 ? 'Please enter a venue name (at least 2 characters).' : undefined),
    },
    onSubmit: async (vals) => {
      setErrMsg('');
      // Only send filled fields; the API treats empty strings as unset.
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(vals)) {
        const trimmed = String(v ?? '').trim();
        if (trimmed !== '') body[k] = trimmed;
      }
      try {
        const venue = await createVenue(body);
        const slug = venue?.slug;
        onNavigate('owner-venue', { id: slug || String(venue?.id ?? '') });
      } catch (err) {
        setErrMsg(
          err instanceof ApiError && err.status === 401
            ? 'Your session expired — sign in again.'
            : err instanceof ApiError && err.status === 400
              ? 'Some fields are invalid. Check the form and try again.'
              : 'Could not create the venue. Try again in a moment.',
        );
      }
    },
  });

  const bind = (k: keyof typeof form.values) => ({
    value: form.values[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => form.setField(k, e.target.value),
  });

  // Match a reverse-geocoded place name to one of our seeded cities. Nominatim
  // and our list spell the same place a few ways ("Bacoor" / "City of Bacoor"),
  // so normalise (drop "city", punctuation) before comparing.
  const normCity = (s: string) =>
    s.toLowerCase().replace(/\bcity\b/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const matchCity = (name: string): ApiCity | null => {
    const n = normCity(name);
    if (!n) return null;
    return (
      cities.find((c) => normCity(c.name) === n) ??
      cities.find((c) => { const cn = normCity(c.name); return cn !== '' && (cn.startsWith(n) || n.startsWith(cn)); }) ??
      null
    );
  };

  // Record the address parts a geocode lookup resolved. CITY: the detected name
  // is written straight into the City *text* field (the map is the source of
  // truth — no dropdown to "pick from"); when it happens to match one of our
  // seeded cities we also link its `cityId` behind the scenes so city filtering
  // keeps working. STREET / POSTCODE / PROVINCE: filled into the matching fields.
  // `replace` overwrites on an explicit address pick; nudging the pin only fills
  // blanks (so a small drag never wipes what the owner typed) — except the City,
  // which always follows the pin since auto-filling it is the whole point.
  const applyDetectedPlace = (
    parts: { city: string | null; region: string | null; line1: string | null; postcode: string | null },
    replace: boolean,
  ) => {
    if (parts.city) {
      form.setField('cityName', parts.city);
      form.setField('cityId', matchCity(parts.city)?.id ?? '');
      setPinCity([parts.city, parts.region].filter(Boolean).join(' · '));
    }
    const fill = (k: 'addressLine1' | 'postalCode' | 'region', v: string | null) => {
      if (v && (replace || !String(form.values[k] ?? '').trim())) form.setField(k, v);
    };
    fill('region', parts.region);
    fill('addressLine1', parts.line1);
    fill('postalCode', parts.postcode);
  };

  // Drop/move the pin → save the coords and reverse-geocode to auto-fill the address.
  const handlePin = async (la: number, ln: number) => {
    form.setField('lat', la.toFixed(6));
    form.setField('lng', ln.toFixed(6));
    setPinCity(null);
    setDetecting(true);
    try {
      const hit = await reverseGeocode(la, ln);
      if (hit) applyDetectedPlace(hit, false);
    } catch {
      /* best-effort: the pin (lat/lng) is set regardless of address detection */
    } finally {
      setDetecting(false);
    }
  };

  // Owner picked an address from the type-ahead → drop the pin there, fly the
  // map to it, and fill city/street/postcode from the suggestion's parsed parts
  // (no reverse-geocode round-trip needed, the suggestion already carries them).
  const handleAddressSelect = (s: GeocodeSuggestion) => {
    form.setField('lat', s.lat.toFixed(6));
    form.setField('lng', s.lng.toFixed(6));
    setFlyTarget([s.lat, s.lng]);
    setDetecting(false);
    applyDetectedPlace(s, true);
  };

  const pinLat = form.values.lat ? Number(form.values.lat) : null;
  const pinLng = form.values.lng ? Number(form.values.lng) : null;

  return (
    <div className="scroll safe-top safe-bottom px-5">
      <ScreenHeader onBack={onBack} backIcon="close" eyebrow="Owner console" title="Create a new venue" subtitle="Only the name is required — fill in the rest on the editor after." className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]" />

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-[var(--primary-tint)] px-4 py-3">
        <Icon name="help" size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
        <p className="text-[13px] text-[var(--ink-2)]">Already in our directory? Find and claim it from the Courts tab instead, to avoid a duplicate listing.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.submit();
        }}
        className="space-y-4"
      >
        <OwnerSection title="Basics" icon="edit">
          <div className="space-y-3.5">
            <FormField
              label="Venue name"
              required
              placeholder="e.g. Smash City Pickleball"
              maxLength={200}
              {...bind('displayName')}
              onBlur={() => form.setTouched('displayName')}
              error={form.touched.displayName ? form.errors.displayName : undefined}
            />
            <FormField label="One-line summary" placeholder="A short hook shown in search results" maxLength={255} {...bind('oneLineSummary')} />
            <div className="field p-0!">
              <label className="lbl">Description</label>
              <textarea className="control" rows={4} value={form.values.description} onChange={(e) => form.setField('description', e.target.value)} />
            </div>
          </div>
        </OwnerSection>

        <OwnerSection title="Location" icon="location" description="Search your address for suggestions, or tap the map to drop a pin (or drag it) — we’ll fill in the address below for you.">
          <div className="space-y-3.5">
            <AddressAutocomplete
              label="Search address"
              value={form.values.fullAddress}
              onChange={(v) => form.setField('fullAddress', v)}
              onSelect={handleAddressSelect}
              placeholder="Start typing — e.g. Smash City, Makati"
              hint="Pick a suggestion to drop the map pin and auto-fill the address below."
            />
            <MapPinPicker lat={pinLat} lng={pinLng} onPin={handlePin} flyTo={flyTarget} />
            {pinLat != null && pinLng != null && (
              <div className="flex items-start gap-2 rounded-xl bg-[var(--primary-tint)] px-3 py-2.5">
                <Icon name="location" size={15} className="shrink-0 text-[var(--primary)] mt-0.5" />
                <p className="text-[12.5px] text-[var(--ink-2)]">
                  Pin set at {pinLat.toFixed(4)}, {pinLng.toFixed(4)}.
                  {detecting
                    ? ' Detecting address…'
                    : pinCity
                      ? <> Detected: <strong className="text-[var(--ink)]">{pinCity}</strong> — filled in below. Edit anything that’s off.</>
                      : ' Fill in the address below.'}
                </p>
              </div>
            )}
            <FormField label="Address line 1" placeholder="Street & building no." maxLength={200} {...bind('addressLine1')} />
            <FormField label="Address line 2" placeholder="Unit, floor, landmark (optional)" maxLength={200} {...bind('addressLine2')} />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="City"
                placeholder="e.g. Makati"
                maxLength={100}
                value={form.values.cityName}
                onChange={(e) => {
                  const v = e.target.value;
                  form.setField('cityName', v);
                  // Link a seeded city behind the scenes when the typed name matches
                  // one (keeps city filtering working); otherwise it's free text.
                  form.setField('cityId', matchCity(v)?.id ?? '');
                }}
              />
              <FormField label="Postcode" placeholder="e.g. 1200" inputMode="numeric" maxLength={20} {...bind('postalCode')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Latitude" placeholder="14.5547" inputMode="decimal" {...bind('lat')} />
              <FormField label="Longitude" placeholder="121.0244" inputMode="decimal" {...bind('lng')} />
            </div>
            <p className="-mt-1.5 text-[12px] text-[var(--muted)]">Auto-set from the map pin — edit only if you have exact coordinates.</p>
          </div>
        </OwnerSection>

        <OwnerSection title="Contact" icon="message">
          <div className="space-y-3.5">
            <FormField label="Phone" maxLength={20} {...bind('phone')} />
            <FormField label="Email" type="email" maxLength={255} {...bind('email')} />
            <FormField label="Website" placeholder="https://" {...bind('website')} />
          </div>
          <div className="t-sm text-[var(--muted)] mt-2">
            A shareable booking link is generated automatically once your venue is created — customize it anytime from the listing editor.
          </div>
        </OwnerSection>

        <OwnerSection title="What happens next" icon="check" description="Creating the venue is one tap — then you flesh it out in the editor.">
          <div className="space-y-2.5">
            {[
              { icon: 'paddle', label: 'Add courts & set rates', sub: 'Per-court pricing, surface, indoor/outdoor & photos' },
              { icon: 'clock', label: 'Set your hours', sub: 'Weekly schedule + one-off holiday closures' },
              { icon: 'calendar', label: 'Choose how bookings work', sub: 'Instant booking, or approve each request first' },
              { icon: 'share', label: 'Share your booking link', sub: 'Auto-generated — players reserve a court in a tap' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Icon name={s.icon} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-[var(--ink)]">{s.label}</div>
                  <div className="t-sm">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </OwnerSection>

        {errMsg && <div className="t-sm text-[var(--coral)] font-bold text-center">{errMsg}</div>}
        <Button type="submit" fullWidth disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Creating…' : 'Create venue'}
        </Button>
      </form>
    </div>
  );
}
