import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Chip } from '../ui/Chip';

interface NearbyFilterSheetProps {
  open: boolean;
  onClose: () => void;
}

const AMENITIES = ['Restrooms', 'Lighted', 'Pro Shop', 'Water', 'Seating', 'Parking'];

export function NearbyFilterSheet({ open, onClose }: NearbyFilterSheetProps) {
  const [courtType, setCourtType] = useState('All');
  const [access, setAccess] = useState('Any');
  const [distance, setDistance] = useState(5);
  const [amenities, setAmenities] = useState<Set<string>>(new Set());

  const toggle = (a: string) => {
    setAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const reset = () => {
    setCourtType('All');
    setAccess('Any');
    setDistance(5);
    setAmenities(new Set());
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter courts"
      subtitle="Pick your kind of court."
      height="74dvh"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary outline" style={{ margin: 0, width: '100%', flex: 1 }} onClick={reset}>
            Reset
          </button>
          <button className="btn-primary dark" style={{ margin: 0, width: '100%', flex: 2 }} onClick={onClose}>
            Show results
          </button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">Court type</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', 'Indoor', 'Outdoor'].map((o) => (
            <Chip key={o} selected={courtType === o} onClick={() => setCourtType(o)}>{o}</Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Access</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Any', 'Public', 'Membership', 'Fee Required'].map((o) => (
            <Chip key={o} selected={access === o} onClick={() => setAccess(o)}>{o}</Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Max distance · {distance} mi</div>
        <input
          type="range"
          min="1"
          max="25"
          value={distance}
          onChange={(e) => setDistance(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
          <span>1 mi</span>
          <span>25 mi</span>
        </div>
      </div>

      <div className="field">
        <div className="lbl">Amenities</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AMENITIES.map((a) => (
            <Chip key={a} selected={amenities.has(a)} onClick={() => toggle(a)}>{a}</Chip>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
