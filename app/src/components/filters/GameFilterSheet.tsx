import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

interface GameFilterSheetProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: 'skill', title: 'Skill level', options: ['All', 'Beginner', 'Intermediate', 'Advanced'] },
  { id: 'type', title: 'Game type', options: ['All', 'Singles', 'Doubles', 'Open Play'] },
  { id: 'day', title: 'Day', options: ['Any', 'Today', 'Tomorrow', 'This Week', 'This Weekend'] },
  { id: 'time', title: 'Time of day', options: ['Any', 'Morning', 'Afternoon', 'Evening'] },
  { id: 'distance', title: 'Distance', options: ['Any', 'Under 1 mi', 'Under 5 mi', 'Under 10 mi', 'Under 25 mi'] },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const initialSelections: Record<SectionId, string> = {
  skill: 'All',
  type: 'All',
  day: 'Any',
  time: 'Any',
  distance: 'Any',
};

export function GameFilterSheet({ open, onClose }: GameFilterSheetProps) {
  const [selected, setSelected] = useState<Record<SectionId, string>>(initialSelections);

  const reset = () => setSelected(initialSelections);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter games"
      subtitle="Refine by skill, time, or distance."
      footer={
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="md" onClick={reset}>Reset</Button>
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            Apply filters
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.id} className="space-y-3">
            <h3 className="font-heading text-body-lg font-bold text-on-surface">{section.title}</h3>
            <div className="flex flex-wrap gap-2">
              {section.options.map((option) => (
                <Chip
                  key={option}
                  selected={selected[section.id] === option}
                  onClick={() => setSelected((prev) => ({ ...prev, [section.id]: option }))}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}
