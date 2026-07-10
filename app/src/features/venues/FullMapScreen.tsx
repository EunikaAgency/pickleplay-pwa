import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { listAllVenues, type ApiVenue } from '../../shared/lib/api';
import { venueCoords } from '../../shared/lib/venueDisplay';

// Metro Manila fallback centre
const FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Pin {
  v: ApiVenue;
  lat: number;
  lng: number;
}

/**
 * A public, no-auth full-screen venue map — just pins on a map, no interaction.
 * Personal-use view of all directory venues, reachable at /map.
 */
export function FullMapScreen() {
  const [venues, setVenues] = useState<ApiVenue[]>([]);

  useEffect(() => {
    listAllVenues()
      .then(setVenues)
      .catch(() => setVenues([]));
  }, []);

  const pins = useMemo<Pin[]>(() =>
    venues.flatMap((v) => {
      const c = venueCoords(v);
      return c ? [{ v, lat: c[0], lng: c[1] }] : [];
    }),
  [venues]);

  const center: [number, number] = pins.length > 0
    ? [pins[0].lat, pins[0].lng]
    : FALLBACK_CENTER;

  return (
    <div className="fullmap-screen">
      <MapContainer center={center} zoom={12} className="fullmap-leaflet" zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker
            key={p.v.id}
            position={[p.lat, p.lng]}
            icon={markerIcon}
            interactive={false}
          />
        ))}
      </MapContainer>
    </div>
  );
}
