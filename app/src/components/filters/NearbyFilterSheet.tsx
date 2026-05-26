import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

interface NearbyFilterSheetProps {
  open: boolean;
  onClose: () => void;
}

const SINGLE_SELECT = [
  { id: 'type', title: 'Court type', options: ['All', 'Indoor', 'Outdoor'] },
  { id: 'access', title: 'Access', options: ['Any', 'Public', 'Membership', 'Fee Required'] },
  { id: 'count', title: 'Number of courts', options: ['Any', '1–2', '3–6', '7–12', '12+'] },
  { id: 'surface', title: 'Surface', options: ['Any', 'Concrete', 'Asphalt', 'Acrylic', 'Wood'] },
] as const;

type SingleId = (typeof SINGLE_SELECT)[number]['id'];

const AMENITIES = ['Restrooms', 'Lighted', 'Pro Shop', 'Water Fountain', 'Seating', 'Parking'];

const initialSingles: Record<SingleId, string> = {
  type: 'All',
  access: 'Any',
  count: 'Any',
  surface: 'Any',
};

export function NearbyFilterSheet({ open, onClose }: NearbyFilterSheetProps) {
  const [singles, setSingles] = useState<Record<SingleId, string>>(initialSingles);
  const [amenities, setAmenities] = useState<Set<string>>(new Set());

  const reset = () => {
    setSingles(initialSingles);
    setAmenities(new Set());
  };

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter courts"
      subtitle="Pick your kind of court."
      footer={
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="md" onClick={reset}>Reset</Button>
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            Show results
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {SINGLE_SELECT.map((section) => (
          <section key={section.id} className="space-y-3">
            <h3 className="font-heading text-body-lg font-bold text-on-surface">{section.title}</h3>
            <div className="flex flex-wrap gap-2">
              {section.options.map((option) => (
                <Chip
                  key={option}
                  selected={singles[section.id] === option}
                  onClick={() => setSingles((prev) => ({ ...prev, [section.id]: option }))}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-3">
          <h3 className="font-heading text-body-lg font-bold text-on-surface">Amenities</h3>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <Chip key={a} selected={amenities.has(a)} onClick={() => toggleAmenity(a)}>
                {a}
              </Chip>
            ))}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
