import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { NearbyFilterSheet } from '../components/filters/NearbyFilterSheet';
import { useDemoState } from '../lib/demoState';

interface NearbyScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const COURTS = [
  { id: '1', name: 'Riverside Courts',    rating: 4.5, dist: '1.2 mi', label: '4 open',   tags: ['Lighted', 'Free'],     access: 'Public', lat: 30.255, lng: -97.735 },
  { id: '2', name: 'Austin Smash Center', rating: 4.9, dist: '0.8 mi', label: '$25/hr',   tags: ['Indoor', 'Pro Shop'],  access: 'Indoor', lat: 30.2672, lng: -97.7431 },
  { id: '3', name: 'Central Hub',         rating: 4.3, dist: '0.5 mi', label: 'Open',     tags: ['Indoor'],              access: 'Member', lat: 30.275, lng: -97.745 },
  { id: '4', name: 'Zilker Park Courts',  rating: 4.7, dist: '2.4 mi', label: 'Free',     tags: ['Lighted', 'Free'],     access: 'Public', lat: 30.265, lng: -97.770 },
  { id: '5', name: 'The Pickle Lodge',    rating: 5.0, dist: '4.1 mi', label: 'Club',     tags: ['Lounge'],              access: 'Club',   lat: 30.3075, lng: -97.730 },
];

const ROW_GRADIENTS = [
  'linear-gradient(135deg, #c1f100, #a5d100)',
  'linear-gradient(135deg, #0040e0, #6c83ff)',
  'linear-gradient(135deg, #cf3000, #ff7355)',
  'linear-gradient(135deg, #abd600, #5b7400)',
  'linear-gradient(135deg, #404756, #1a1d24)',
];

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

type SheetState = 'collapsed' | 'expanded';

export function NearbyScreen({ onNavigate }: NearbyScreenProps) {
  const [active, setActive] = useState(2);
  const [filterOpen, setFilterOpen] = useState(false);
  const [useRealMap, setUseRealMap] = useState(false);
  const [sheet, setSheet] = useState<SheetState>('collapsed');
  const { state: demoState } = useDemoState();

  const austinCenter: [number, number] = [30.275, -97.745];

  if (demoState === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom" style={{ padding: '0 16px' }}>
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }
  if (demoState === 'error') {
    return (
      <div className="scroll safe-top safe-bottom">
        <ErrorState
          title="Couldn't load courts"
          message="We couldn't reach the courts directory. Pull down to retry."
          onRetry={() => {}}
        />
      </div>
    );
  }
  if (demoState === 'empty') {
    return (
      <div className="scroll safe-top safe-bottom">
        <EmptyState
          icon="location"
          title="No courts within 5 miles"
          description="Try a wider radius, or help the community by adding a court you know."
          action={{ label: 'Add a court', onPress: () => {} }}
        />
      </div>
    );
  }

  const isCollapsed = sheet === 'collapsed';
  // Sheet sits at bottom:0 with 92px padding-bottom for the floating tab bar.
  // The numbers here describe TOTAL sheet height (visible content + tab bar clearance).
  const TAB_CLEARANCE = 92;
  const sheetHeight = isCollapsed
    ? 170 + TAB_CLEARANCE
    : Math.round(window.innerHeight * 0.55) + TAB_CLEARANCE;

  return (
    <div className="map-screen">
      {useRealMap ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <MapContainer center={austinCenter} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToUser />
            {COURTS.map((c, i) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon} eventHandlers={{ click: () => setActive(i) }}>
                <Popup>
                  <div
                    style={{ minWidth: 180, cursor: 'pointer' }}
                    onClick={() => onNavigate('court-details', { id: c.id })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name="location" size={14} />
                      <strong>{c.name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666' }}>
                      <Icon name="star" size={12} /> {c.rating} · {c.dist} · {c.access}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="map-canvas">
          <div className="road" style={{ left: 0, top: '30%', width: '100%', height: 6 }} />
          <div className="road" style={{ left: 0, top: '60%', width: '100%', height: 4 }} />
          <div className="road" style={{ left: 0, top: '85%', width: '100%', height: 5 }} />
          <div className="road" style={{ left: '30%', top: 0, width: 4, height: '100%' }} />
          <div className="road" style={{ left: '65%', top: 0, width: 5, height: '100%' }} />
          <div className="park" style={{ left: '8%', top: '50%', width: 100, height: 80 }} />
          <div className="park" style={{ left: '70%', top: '20%', width: 90, height: 70 }} />
          <div className="water" style={{ left: '-10%', top: '20%', width: 160, height: 90 }} />
          <div className="water" style={{ left: '60%', top: '78%', width: 200, height: 80 }} />

          {[
            { left: '22%', top: '38%' },
            { left: '42%', top: '52%' },
            { left: '55%', top: '40%' },
            { left: '32%', top: '70%' },
            { left: '70%', top: '62%' },
          ].map((pos, i) => {
            const c = COURTS[i];
            return (
              <button
                key={c.id}
                className={`map-pin ${i === active ? 'active' : ''}`}
                style={{ left: pos.left, top: pos.top, position: 'absolute' }}
                onClick={() => setActive(i)}
              >
                <span className="pinwrap">
                  <Icon name="paddle" size={12} />
                  {c.label}
                </span>
              </button>
            );
          })}

          {/* You-are-here marker */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 18,
              height: 18,
              borderRadius: 50,
              background: '#3b82f6',
              border: '3px solid white',
              boxShadow: '0 0 0 4px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.2)',
            }}
          />
        </div>
      )}

      {/* Search — clickable, opens SearchScreen */}
      <button type="button" className="map-search" onClick={() => onNavigate('search')}>
        <Icon name="search" size={16} />
        <span className="text">Find courts near you</span>
        <Avatar name="Riley Pickler" size={32} />
      </button>

      {/* Chip row */}
      <div className="map-chip-row">
        <button className="chip lime">
          <Icon name="paddle" size={12} /> Courts
        </button>
        <button className="chip">Games here</button>
        <button className="chip">Indoor</button>
        <button className="chip">Free</button>
        <button className="chip">Lighted</button>
      </div>

      {/* Floating control stack — always visible above the sheet */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: sheetHeight + 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1100,
          transition: 'bottom .3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        }}
      >
        <button
          aria-label={useRealMap ? 'Show stylized map' : 'Show real map'}
          onClick={() => setUseRealMap((v) => !v)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: useRealMap ? 'var(--lime)' : 'rgba(255,255,255,0.95)',
            color: useRealMap ? 'var(--lime-ink)' : 'var(--primary)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            border: '0.5px solid var(--hairline)',
          }}
        >
          <Icon name="layers" size={18} />
        </button>
        <button
          aria-label="Locate me"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.95)',
            color: 'var(--primary)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            border: '0.5px solid var(--hairline)',
          }}
        >
          <Icon name="navigate" size={18} />
        </button>
      </div>

      {/* Bottom sheet — collapsible. Tap the chevron to toggle. */}
      <div className="map-sheet" style={{ height: sheetHeight, transition: 'height .3s cubic-bezier(0.4, 0.0, 0.2, 1)' }}>
        <button
          type="button"
          onClick={() => setSheet((s) => (s === 'collapsed' ? 'expanded' : 'collapsed'))}
          aria-label={isCollapsed ? 'Expand court list' : 'Collapse court list'}
          aria-expanded={!isCollapsed}
          style={{
            width: '100%',
            padding: '10px 0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 999,
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform .25s ease',
            }}
          >
            <Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} />
          </span>
          {isCollapsed ? 'Show list' : 'Hide list'}
        </button>
        <div className="head">
          <div>
            <div className="t-eyebrow">Nearby · {COURTS.length} courts</div>
            <div className="hd-2" style={{ marginTop: 2 }}>
              Within 5 mi
            </div>
          </div>
          <button className="chip" style={{ background: 'var(--surface-2)' }} onClick={() => setFilterOpen(true)}>
            <Icon name="sliders" size={12} /> Filter
          </button>
        </div>
        <div className="list">
          {COURTS.map((c, i) => (
            <button
              key={c.id}
              className="court-row"
              style={{
                background: i === active ? 'var(--lime-soft)' : 'var(--surface-2)',
                border: i === active ? '0.5px solid rgba(193,241,0,0.5)' : '0.5px solid transparent',
              }}
              onClick={() => {
                setActive(i);
                onNavigate('court-details', { id: c.id });
              }}
            >
              <div
                className="img"
                style={{
                  background: ROW_GRADIENTS[i % ROW_GRADIENTS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <Icon name="paddle" size={24} />
              </div>
              <div className="body">
                <div className="title">{c.name}</div>
                <div className="row1">
                  <Icon name="star" size={11} style={{ color: '#c89000' }} /> {c.rating}
                  <span style={{ opacity: 0.5 }}>·</span>
                  {c.dist}
                  <span style={{ opacity: 0.5 }}>·</span>
                  {c.access}
                </div>
                <div className="tags">
                  {c.tags.map((t) => (
                    <span key={t} className="t">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="directions" size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <NearbyFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
