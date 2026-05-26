import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../components/ui/Icon';

interface NearbyScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const demoCourts = [
  {
    id: '1', name: 'Austin Smash Center', rating: 4.9, distance: '0.8 miles away • Downtown',
    tags: ['Restrooms', 'Pro Shop', 'Coffee'], courtCount: 6, access: 'Indoor',
    lat: 30.2672, lng: -97.7431,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsL986uwrjRnAFPLVZTE71SgRlgtERnWB_O-_u-mg4qaddBohUzg2f9di6EjSOELb6gOdw5hpL_oiC_o8ZrPChGext6DF4-_g10CoLCaIMBtZ1oDYsDm-Q89VmI4GCI4qum9HaYOx0PQN98F1AJfvJh0jZUfJpE5qf_wdLWBpxpdg4Q0O9J_lQlCGuXKu6RCm-me0mSj6T7miyRvXid9yuUZHJgdgUeLXoT18Lf6wzh6Z3ZM0VQGmIKAHPEmkQ69DWo8kMreU1',
  },
  {
    id: '2', name: 'Zilker Park Courts', rating: 4.7, distance: '2.4 miles away • South Austin',
    tags: ['Lighted', 'Free'], courtCount: 4, access: 'Public',
    lat: 30.2650, lng: -97.7700,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDa2ERNy2GGwjBkw4-3pvNcU9GWPQXFx7_RdJgrZXkBOtqYhp1ImtS5_TIiuky0GsnGS2b_mMt-axhoWEFF-CJuJszESpVrCQudWflWVgGUZMySfGLU-rVb82QdT8mrWpllsd_8koBYuTHhnwi1xhdcYK_aj_El7fUBswk-C_f0zCVg6RJuzCxYAXz0jPasoM97qvgzAx96oRw1LTzzkK7J7y7SniEFa7YOCA5HiCRD7gD1k2VgAPJOABL8-txI4OIwGuRWEPYX',
  },
  {
    id: '3', name: 'The Pickle Lodge', rating: 5.0, distance: '4.1 miles away • North Loop',
    tags: ['Showers', 'Lounge'], courtCount: 8, access: 'Club',
    lat: 30.3075, lng: -97.7300,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARk0pzgK8gYkMfbZ40r6oCDE9S9XldNiMq2e6nnQ4M38al1LG__JRRFt7p5T2-u98nFVpJvflXX_Q1i43TmRTjg9B89WedV4cQURvA5FvWQOi7Cd6e5M4YZAYiHCvsck0gdQSXDHG1BTIuhH0bpERvegmC4G0-O0oh52YMKfwkRQucFoQo3TeQHkzpQjViV8OuDiBOKw731nBnUqB0QADFHOvEz2X4asznNoRyqw14fFzqFgkrRDA7Z8DCpnd9FWWm4LFxdUhs',
  },
  {
    id: '4', name: 'Riverside Courts', rating: 4.5, distance: '1.2 miles away • East Austin',
    tags: ['Lighted', 'Water'], courtCount: 8, access: 'Public',
    lat: 30.2550, lng: -97.7350,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCChxs_Ha_J-LXMi4XCQ_MOHPsTAP5ZjyQxCUKRzWuKcG2mkY_6TfaKUIUQgIa1dkqtSmhqJxDL9wzo3Lu2-01dUQUs-qOlNKQMKROuzPb-CEBnX1Jlr7B-F1HoSkvLpgNQumifF8tgOgC09jBT9MZ7DdYnOk9uKosrqKILjo7IqZZwl1UCbMJe5hYWd7rvb6ovMrYTRut0xbPwkuGRt5TcVdrZsyirbLQUpL1TX5wKLy4kH6aaV4Wj9TTLhYeMTCWUkKqNeK5z',
  },
  {
    id: '5', name: 'Central Hub Courts', rating: 4.3, distance: '0.5 miles away • Central',
    tags: ['Indoor', 'Pro Shop'], courtCount: 10, access: 'Membership',
    lat: 30.2750, lng: -97.7450,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB74wZImg86YqASBE9mTA8ilIQtez1ABlecRRJ-hbZ_Mm2dN-gFFIH8flXECbNEFThD4jo9iJeyUIYqVODn1Y3CYEirLVSLw4XO2ZLxXnoeDNspU0-9Rtr3Le2uwzxR9AVThARneifahVE8WcplIL-u1EhxHgyHw7lNm6L7uzN_TZ7LyuQWkyXcUOowoIEodYrAU5mnPLacJP7sSYjdWW0-55C_qZ5LEcTSTk0ZaL2M8ZmIFyZRdlsKLj3tLtoWyzQDw5XJavcD',
  },
];

const filters = ['Filters', 'Indoor', 'Public', 'Lighted', 'Available Now'];

// Fix Leaflet default marker icon issue with bundlers
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FlyToUser() {
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 14 });
  }, [map]);

  return null;
}

function LocateButton() {
  const map = useMap();

  return (
    <button
      onClick={() => map.locate({ setView: true, maxZoom: 14 })}
      className="absolute bottom-24 right-4 z-[1000] w-12 h-12 rounded-full bg-surface-container-lowest shadow-lg flex items-center justify-center active:scale-90 transition-all"
      style={{ boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.15)' }}
    >
      <Icon name="my_location" size={22} className="text-primary" />
    </button>
  );
}

export function NearbyScreen({ onNavigate }: NearbyScreenProps) {
  const [activeTab, setActiveTab] = useState<'courts' | 'games'>('courts');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const austinCenter: [number, number] = [30.2750, -97.7450];

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-7xl px-5 pt-6 space-y-6">

          {/* Toggle Switcher */}
          <div className="flex justify-center">
            <div className="relative flex w-full max-w-xs rounded-full bg-surface-container-high p-1">
              <button
                onClick={() => setActiveTab('courts')}
                className={`flex-1 rounded-full py-2 text-center font-heading text-body-md font-bold transition-colors z-10 ${
                  activeTab === 'courts' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                }`}
              >
                Courts
              </button>
              <button
                onClick={() => setActiveTab('games')}
                className={`flex-1 rounded-full py-2 text-center font-heading text-body-md font-bold transition-colors z-10 ${
                  activeTab === 'games' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                }`}
              >
                Games
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            {filters.map((label, i) => (
              <button
                key={label}
                onClick={() => {
                  if (i === 0) onNavigate('nearby-filters');
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 whitespace-nowrap text-label-sm font-bold transition-all active:scale-95 ${
                  i === 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {i === 0 && <Icon name="tune" size={16} />}
                {label}
              </button>
            ))}
          </div>

          {/* View Title + Map/List Toggle */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-heading text-headline-lg-mobile md:text-headline-lg">Nearby in Austin</h2>
              <p className="text-body-md text-on-surface-variant">24 courts found within 5 miles</p>
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className="rounded-full bg-primary p-3 text-on-primary transition-all active:scale-90"
              style={cardShadow}
            >
              <Icon name={viewMode === 'list' ? 'map' : 'format_list_bulleted'} size={22} />
            </button>
          </div>

          {/* Map View */}
          {activeTab === 'courts' && viewMode === 'map' && (
            <div className="rounded-[24px] overflow-hidden" style={{ height: '60vh', minHeight: '400px', ...cardShadow }}>
              <MapContainer
                center={austinCenter}
                zoom={13}
                className="h-full w-full"
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyToUser />
                <LocateButton />
                {demoCourts.map((court) => (
                  <Marker
                    key={court.id}
                    position={[court.lat, court.lng]}
                    icon={markerIcon}
                  >
                    <Popup>
                      <div
                        className="cursor-pointer min-w-[180px]"
                        onClick={() => onNavigate('court-details', { id: court.id })}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="location_on" size={16} className="text-primary" filled />
                          <strong className="text-body-md">{court.name}</strong>
                        </div>
                        <div className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                          <Icon name="star" size={12} filled className="text-secondary" />
                          {court.rating} &middot; {court.courtCount} courts &middot; {court.access}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* List View */}
          {activeTab === 'courts' && viewMode === 'list' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4">
              {demoCourts.map((court) => (
                <div
                  key={court.id}
                  className="group cursor-pointer overflow-hidden rounded-[24px] bg-surface-container-lowest transition-all active:scale-[0.98]"
                  style={cardShadow}
                  onClick={() => onNavigate('court-details', { id: court.id })}
                >
                  <div className="relative h-48">
                    <img alt="Court" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={court.img} />
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold text-on-secondary-container">
                        {court.access}
                      </span>
                      <span className="rounded-full bg-surface-container-lowest/90 px-3 py-1 text-label-sm font-bold text-primary backdrop-blur-sm">
                        {court.courtCount} Courts
                      </span>
                    </div>
                    <button className="absolute bottom-3 right-3 rounded-full bg-surface-container-lowest p-2 text-error shadow-md transition-all active:scale-90">
                      <Icon name="favorite" size={18} filled />
                    </button>
                  </div>
                  <div className="space-y-1 p-5">
                    <div className="flex items-start justify-between">
                      <h3 className="font-heading text-headline-md">{court.name}</h3>
                      <div className="flex items-center gap-1">
                        <Icon name="star" size={16} filled className="text-secondary" />
                        <span className="text-label-sm font-bold">{court.rating}</span>
                      </div>
                    </div>
                    <p className="flex items-center gap-1 text-body-md text-on-surface-variant">
                      <Icon name="location_on" size={16} />
                      {court.distance}
                    </p>
                    <div className="flex gap-2 pt-2 overflow-hidden">
                      {court.tags.map((tag) => (
                        <span key={tag} className="rounded-md border border-outline-variant px-2 py-0.5 text-label-sm font-bold uppercase tracking-wider text-outline">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Featured CTA Card */}
              <div className="flex flex-col items-center justify-center rounded-[24px] bg-primary p-5 text-center text-on-primary transition-all active:scale-[0.98] cursor-pointer md:col-span-2 lg:col-span-1">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container">
                  <Icon name="add_location" size={36} className="text-on-secondary-container" />
                </div>
                <h3 className="font-heading text-headline-md mb-2">Missing a court?</h3>
                <p className="text-body-md opacity-90 mb-4">Help the community grow by adding a local spot you know about!</p>
                <button className="rounded-full bg-secondary-fixed px-8 py-3 font-bold text-on-secondary-fixed transition-all active:scale-95" style={cardShadow}>
                  Add it now!
                </button>
              </div>
            </div>
          )}

          {/* Games Tab */}
          {activeTab === 'games' && (
            <div className="py-12 text-center space-y-4">
              <Icon name="sports_tennis" size={48} className="mx-auto text-outline-variant" />
              <p className="font-heading text-headline-md text-on-surface-variant">Finding live games near you...</p>
              <p className="text-body-md text-on-surface-variant">Switch to the Games tab to browse and filter.</p>
              <button
                onClick={() => onNavigate('games')}
                className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-6 py-3 font-bold text-on-secondary-container active:scale-95 transition-all"
              >
                Browse Games
                <Icon name="arrow_forward" size={18} />
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
