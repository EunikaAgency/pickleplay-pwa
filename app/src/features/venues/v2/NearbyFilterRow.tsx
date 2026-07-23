import { useEffect, useRef, useState } from 'react';

// The Nearby filter row: date · area · court type.
//
// The two pickers are custom dropdowns rather than native <select>s for the
// same reason the sort control is — a native popup renders outside the
// device-preview frame. The date stays a native <input type="date"> (its picker
// is anchored by the browser, not drawn in-page).

export interface FilterOption {
  value: string;
  label: string;
}

function FilterSelect({ value, options, onChange, ariaLabel }: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="nv-select" ref={ref}>
      <button
        type="button"
        className={`nv-select-btn${value ? ' active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${current?.label ?? ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nv-select-val">{current?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <ul className="nv-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`nv-select-item${o.value === value ? ' active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
                {o.value === value && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NearbyFilterRow({
  date, onDateChange, minDate,
  area, areas, onAreaChange,
  type, onTypeChange,
  loading,
}: {
  date: string;
  onDateChange: (date: string) => void;
  minDate: string;
  area: string;
  areas: string[];
  onAreaChange: (area: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
  loading?: boolean;
}) {
  const areaOptions: FilterOption[] = [
    { value: '', label: 'All areas' },
    ...areas.map((a) => ({ value: a, label: a })),
  ];
  const typeOptions: FilterOption[] = [
    { value: '', label: 'All types' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
  ];

  return (
    <div className="nv-filter-row">
      <input
        className="nv-date"
        type="date"
        value={date}
        min={minDate}
        onChange={(e) => onDateChange(e.target.value || minDate)}
        aria-label="Show availability for this date"
      />
      <FilterSelect value={area} options={areaOptions} onChange={onAreaChange} ariaLabel="Filter by area" />
      <FilterSelect value={type} options={typeOptions} onChange={onTypeChange} ariaLabel="Filter by court type" />
      {loading && <span className="nv-filter-spin" aria-label="Checking availability" role="status" />}
    </div>
  );
}
