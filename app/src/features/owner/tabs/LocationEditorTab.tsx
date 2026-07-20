import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { Toast } from '../../../shared/components/ui/Toast';
import { FormField } from '../../../shared/components/forms/FormField';
import { OwnerSection } from '../components/OwnerSection';
import { AddressAutocomplete } from '../../../shared/components/forms/AddressAutocomplete';
import { updateVenue, type OwnerVenueDetail, type GeocodeSuggestion } from '../../../shared/lib/api';

interface LocationEditorTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  reload: () => void;
}

// Default map center: Metro Manila (the product's home market).
const DEFAULT_CENTER: [number, number] = [14.5547, 121.0244];

const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const toNum = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function ClickToSet({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onSet(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Pan/zoom to a target only when it changes identity (i.e. a successful search),
// so dragging the pin or typing coordinates never yanks the viewport.
function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 16);
  }, [target, map]);
  return null;
}

export function LocationEditorTab({ venue, venueId, reload }: LocationEditorTabProps) {
  const [lat, setLat] = useState(venue.lat != null ? String(venue.lat) : '');
  const [lng, setLng] = useState(venue.lng != null ? String(venue.lng) : '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [query, setQuery] = useState(venue.fullAddress || [venue.area, venue.region].filter(Boolean).join(', '));
  // The label of the suggestion the owner last picked, for a "Pin moved to …" confirmation.
  const [picked, setPicked] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  // Structured address — now owner-editable (was read-only / staff-managed). The
  // type-ahead pick fills these; the owner can also edit any field directly.
  const [addressLine1, setAddressLine1] = useState(venue.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(venue.addressLine2 || '');
  const [cityName, setCityName] = useState(venue.cityName || venue.city || '');
  const [region, setRegion] = useState(venue.region || '');
  const [postalCode, setPostalCode] = useState(venue.postalCode || '');

  const latNum = toNum(lat);
  const lngNum = toNum(lng);
  const hasPin = latNum != null && lngNum != null;
  const center: [number, number] = hasPin ? [latNum, lngNum] : DEFAULT_CENTER;

  const setPin = (la: number, ln: number) => {
    setLat(la.toFixed(6));
    setLng(ln.toFixed(6));
    setStatus('idle');
  };

  // Picking a suggestion drops the pin AND fills the structured address from the
  // suggestion's parsed parts (so the owner rarely has to type the fields).
  const handleAddressSelect = (s: GeocodeSuggestion) => {
    setPin(s.lat, s.lng);
    setFlyTarget({ lat: s.lat, lng: s.lng });
    setPicked(s.label);
    if (s.line1) setAddressLine1(s.line1);
    if (s.city) setCityName(s.city);
    if (s.region) setRegion(s.region);
    if (s.postcode) setPostalCode(s.postcode);
  };

  const onSave = async () => {
    setStatus('saving');
    try {
      const fields = { addressLine1, addressLine2, cityName, region, postalCode };
      // Only recompute the public one-line `fullAddress` when the owner actually
      // has structured address parts — otherwise leave whatever's on file (don't
      // wipe a venue that only ever had the free-text fullAddress).
      const anyStructured = Object.values(fields).some((v) => v.trim() !== '');
      const composed = [addressLine1, addressLine2, cityName, region, postalCode]
        .map((s) => s.trim()).filter(Boolean).join(', ');
      const body: Record<string, string> = {
        lat: lat.trim(),
        lng: lng.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        cityName: cityName.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
      };
      if (anyStructured) body.fullAddress = composed;
      await updateVenue(venueId, body);
      setStatus('saved');
      reload();
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <OwnerSection title="Map pin" icon="location" description="Start typing your address for suggestions to drop the pin and fill the address below, or tap the map / drag the pin to fine-tune. Nothing saves until you tap “Save location”.">
        <div className="mb-3">
          <AddressAutocomplete
            value={query}
            onChange={(v) => { setQuery(v); if (picked) setPicked(null); }}
            onSelect={handleAddressSelect}
            placeholder="Search an address or place"
          />
        </div>
        {picked && <div className="mb-3 t-sm text-[var(--ink-2)]"><Icon name="check" size={13} className="text-[var(--primary)] inline" /> Pin moved to: {picked}. Drag to fine-tune, then “Save location”.</div>}

        <div className="h-[320px] overflow-hidden rounded-xl border-[0.5px] border-[var(--hairline)]">
          <MapContainer center={center} zoom={hasPin ? 16 : 11} className="w-full h-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToSet onSet={setPin} />
            <FlyTo target={flyTarget} />
            {hasPin && (
              <Marker
                position={[latNum, lngNum]}
                icon={pinIcon}
                draggable
                eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); setPin(p.lat, p.lng); } }}
              />
            )}
          </MapContainer>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3.5">
          <FormField label="Latitude" value={lat} placeholder="14.5547" onChange={(e) => { setLat(e.target.value); setStatus('idle'); }} />
          <FormField label="Longitude" value={lng} placeholder="121.0244" onChange={(e) => { setLng(e.target.value); setStatus('idle'); }} />
        </div>
      </OwnerSection>

      <OwnerSection title="Address" icon="home" description="Shown on your public page. Picking a suggestion above fills these in — edit anything that's off.">
        <div className="space-y-3.5">
          <FormField label="Address line 1" placeholder="Street & building no." maxLength={200} value={addressLine1} onChange={(e) => { setAddressLine1(e.target.value); setStatus('idle'); }} />
          <FormField label="Address line 2" placeholder="Unit, floor, landmark (optional)" maxLength={200} value={addressLine2} onChange={(e) => { setAddressLine2(e.target.value); setStatus('idle'); }} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="City" placeholder="e.g. Makati" maxLength={100} value={cityName} onChange={(e) => { setCityName(e.target.value); setStatus('idle'); }} />
            <FormField label="Postcode" placeholder="e.g. 1200" inputMode="numeric" maxLength={20} value={postalCode} onChange={(e) => { setPostalCode(e.target.value); setStatus('idle'); }} />
          </div>
          <FormField label="Province / region" placeholder="e.g. Metro Manila" maxLength={100} value={region} onChange={(e) => { setRegion(e.target.value); setStatus('idle'); }} />
        </div>
      </OwnerSection>

      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold text-center">Couldn't save your location. Try again.</div>}
      <Button fullWidth onClick={onSave} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Saved</> : 'Save location'}
      </Button>

      <Toast message="Location saved" show={status === 'saved'} />
    </div>
  );
}
