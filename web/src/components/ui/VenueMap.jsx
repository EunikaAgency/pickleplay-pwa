import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

const DEFAULT_CENTER = [39.8283, -98.5795]; // US center
const DEFAULT_ZOOM = 4;

export default function VenueMap({ venues }) {
  if (!venues || venues.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl bg-white shadow-lg">
        <p className="text-on-surface-variant">No venues to show on map</p>
      </div>
    );
  }

  // Center on first venue
  const center = venues.length === 1
    ? [venues[0].lat, venues[0].lng]
    : DEFAULT_CENTER;
  const zoom = venues.length === 1 ? 14 : DEFAULT_ZOOM;

  return (
    <div className="h-[500px] overflow-hidden rounded-2xl shadow-lg">
      <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {venues.map(v => (
          <Marker key={v.id} position={[v.lat, v.lng]}>
            <Popup>
              <div className="min-w-[180px]">
                <img src={v.heroImage} alt="" className="h-24 w-full rounded-xl object-cover mb-2" />
                <Link to={`/venues/${v.slug}`} className="font-heading text-base font-bold text-primary no-underline hover:underline">
                  {v.name}
                </Link>
                <p className="text-sm text-on-surface-variant">{v.city}</p>
                <p className="text-sm mt-1">
                  <span className="font-bold">{v.rating}</span> ★ · {v.courtCount} courts
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
