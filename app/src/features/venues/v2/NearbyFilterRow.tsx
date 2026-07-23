import { useEffect, useRef, useState } from 'react';
import { hourLabel } from './nearbyDisplay';

// Selectable start hours. Courts don't open at 3am, so the list starts at 5 —
// a shorter menu is easier to hit than a complete-but-useless 0–23.
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5 AM … 11 PM

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
  startHour, endHour, onTimeChange,
  area, areas, onAreaChange,
  type, onTypeChange,
  loading, matchCount,
}: {
  date: string;
  onDateChange: (date: string) => void;
  minDate: string;
  /** Start of the required free window, or null for "any time". */
  startHour: number | null;
  /** Exclusive end of that window. Ignored when `startHour` is null. */
  endHour: number | null;
  onTimeChange: (startHour: number | null, endHour: number | null) => void;
  area: string;
  areas: string[];
  onAreaChange: (area: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
  loading?: boolean;
  /** Venues free across the window — shown only while a time filter is on. */
  matchCount?: number | null;
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
  const startOptions: FilterOption[] = [
    { value: '', label: 'Any time' },
    ...HOURS.map((h) => ({ value: String(h), label: hourLabel(h) })),
  ];
  // The window must be at least an hour long, so "to" starts after "from".
  const endOptions: FilterOption[] = startHour == null ? [] : HOURS
    .filter((h) => h > startHour)
    .concat(24)
    .map((h) => ({ value: String(h), label: h === 24 ? '12 MN' : hourLabel(h) }));

  const setStart = (v: string) => {
    if (!v) { onTimeChange(null, null); return; }
    const s = Number(v);
    // Keep the end after the new start; default to a one-hour window.
    const e = endHour != null && endHour > s ? endHour : Math.min(s + 1, 24);
    onTimeChange(s, e);
  };

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
      <FilterSelect
        value={startHour == null ? '' : String(startHour)}
        options={startOptions}
        onChange={setStart}
        ariaLabel="Free from"
      />
      {startHour != null && (
        <FilterSelect
          value={endHour == null ? '' : String(endHour)}
          options={endOptions}
          onChange={(v) => onTimeChange(startHour, Number(v))}
          ariaLabel="Free until"
        />
      )}
      <FilterSelect value={area} options={areaOptions} onChange={onAreaChange} ariaLabel="Filter by area" />
      <FilterSelect value={type} options={typeOptions} onChange={onTypeChange} ariaLabel="Filter by court type" />
      {loading && <span className="nv-filter-spin" aria-label="Checking availability" role="status" />}
      {!loading && startHour != null && matchCount != null && (
        <span className="nv-filter-count">
          {matchCount} free
          <button type="button" className="nv-filter-clear" onClick={() => onTimeChange(null, null)}>Clear</button>
        </span>
      )}
    </div>
  );
}
