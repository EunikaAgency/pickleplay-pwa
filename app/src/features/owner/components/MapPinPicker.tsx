import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * A compact "tap the map to drop a pin" control. Tapping the map or dragging the
 * marker reports new coordinates via `onPin`. Shared by the venue create form and
 * the Location editor tab so both behave identically.
 */

// Default map center: Metro Manila (the product's home market).
const DEFAULT_CENTER: [number, number] = [14.5547, 121.0244];

const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickToSet({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onSet(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Recenter only when the pin lands somewhere new (a search/geolocate), so tapping
// or dragging the pin never yanks the viewport out from under the user.
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15));
  }, [target, map]);
  return null;
}

interface MapPinPickerProps {
  lat: number | null;
  lng: number | null;
  onPin: (lat: number, lng: number) => void;
  /** A point to fly the viewport to (e.g. after a city is detected/searched). */
  flyTo?: [number, number] | null;
  heightClass?: string;
}

export function MapPinPicker({ lat, lng, onPin, flyTo = null, heightClass = 'h-[260px]' }: MapPinPickerProps) {
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat, lng] : DEFAULT_CENTER;

  return (
    <div className={`${heightClass} overflow-hidden rounded-xl border-[0.5px] border-[var(--hairline)]`}>
      <MapContainer center={center} zoom={hasPin ? 15 : 11} className="w-full h-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToSet onSet={onPin} />
        <FlyTo target={flyTo} />
        {hasPin && (
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPin(p.lat, p.lng); } }}
          />
        )}
      </MapContainer>
    </div>
  );
}
