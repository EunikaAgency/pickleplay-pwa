import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { hourLabel } from './nearbyDisplay';

// The Nearby filter row: date · time range · area · court type.
//
// The pickers are custom dropdowns rather than native <select>s for the same
// reason the sort control is — a native popup renders outside the device-preview
// frame. The date stays a native <input type="date"> (its picker is anchored by
// the browser, not drawn in-page).

// Slider bounds — the whole day, midnight to midnight.
const RANGE_MIN = 0;   // 12 MN
const RANGE_MAX = 24;  // 12 MN (next day; exclusive end bound)

export interface FilterOption {
  value: string;
  label: string;
}

/** Closes the popover on an outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/**
 * A dropdown panel that escapes the Nearby sheet's `overflow: hidden`.
 *
 * The sheet is only 188px tall when collapsed, so an in-flow absolute panel is
 * simply cut off. Going `position: fixed` with measured coordinates escapes the
 * clip, and the panel flips above its trigger when there isn't room below —
 * which is the usual case with the map open. Fixed coords resolve against the
 * transformed `.app` frame rather than the viewport, so the frame's origin is
 * subtracted. Mirrors the trick `DateTimeFilterBar`'s HourDropdown already uses.
 *
 * Mounted only while open, so the measuring effect runs on mount.
 */
function AnchoredPanel({ anchorRef, className, minWidth = 0, children, ...rest }: {
  anchorRef: { current: HTMLElement | null };
  className: string;
  minWidth?: number;
  children: ReactNode;
  role?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const panel = ref.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;

    const place = () => {
      const frame = panel.closest('.app')?.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const height = panel.offsetHeight;
      const GAP = 6;
      const EDGE = 8;
      // The tab bar is a fixed sibling that paints *over* this panel — the sheet
      // is a stacking context, so no z-index here can beat it. Treat the tab
      // bar's top as the floor so the panel flips up instead of hiding under it.
      // It's `display: none` on desktop, where getBoundingClientRect() reports
      // all zeros — take the rect only when it has real height, or the floor
      // collapses to 0 and every panel is forced upward.
      const tabRect = document.querySelector('.v2c-tabbar')?.getBoundingClientRect();
      const floor = tabRect && tabRect.height > 0 ? tabRect.top : window.innerHeight;
      const lowest = floor - EDGE - height;
      const below = a.bottom + GAP;
      const above = a.top - GAP - height;
      // Prefer below; flip above when it doesn't fit; clamp when neither does.
      const top = below <= lowest ? below
        : above >= EDGE ? above
        : Math.max(EDGE, Math.min(below, lowest));

      // Keep the panel inside the frame horizontally, too.
      const width = Math.max(a.width, minWidth);
      const frameLeft = frame?.left ?? 0;
      const frameRight = frame?.right ?? window.innerWidth;
      const left = Math.max(frameLeft + EDGE, Math.min(a.left, frameRight - EDGE - width));

      setPos({ top: top - (frame?.top ?? 0), left: left - frameLeft, width });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, minWidth]);

  return (
    <div
      ref={ref}
      className={className}
      // Until measured, the CSS `position: absolute` fallback gives the panel
      // its natural size so `offsetHeight` above is accurate.
      style={pos ? { position: 'fixed', top: pos.top, left: pos.left, width: pos.width } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

function FilterSelect({ value, options, onChange, ariaLabel, searchable, searchPlaceholder }: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Adds a type-to-filter box — worth it once the list is long enough to scroll. */
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.value === value) ?? options[0];

  const close = () => { setOpen(false); setQuery(''); };

  const q = query.trim().toLowerCase();
  // The blank "All …" option is the reset, so it stays reachable while filtering.
  const shown = q
    ? options.filter((o) => !o.value || o.label.toLowerCase().includes(q))
    : options;
  const hasMatches = shown.some((o) => o.value) || !q;

  return (
    <div className="nv-select" ref={ref}>
      <button
        type="button"
        className={`nv-select-btn${value ? ' active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${current?.label ?? ''}`}
        onClick={() => { setQuery(''); setOpen((o) => !o); }}
      >
        <span className="nv-select-val">{current?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <AnchoredPanel anchorRef={ref} className="nv-select-menu" minWidth={190} role="listbox" aria-label={ariaLabel}>
          {searchable && (
            <div className="nv-select-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input
                type="text"
                value={query}
                autoFocus
                placeholder={searchPlaceholder ?? 'Search…'}
                aria-label={`Search ${ariaLabel.toLowerCase()}`}
                onChange={(e) => setQuery(e.target.value)}
                // Enter picks the single remaining match — faster than reaching for it.
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const hits = shown.filter((o) => o.value);
                  if (hits.length === 1) { onChange(hits[0].value); close(); }
                }}
              />
            </div>
          )}
          {hasMatches ? (
            <ul>
              {shown.map((o) => (
                <li key={o.value} role="option" aria-selected={o.value === value}>
                  <button
                    type="button"
                    className={`nv-select-item${o.value === value ? ' active' : ''}`}
                    onClick={() => { onChange(o.value); close(); }}
                  >
                    {o.label}
                    {o.value === value && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="nv-select-empty">No area matches “{query}”</div>
          )}
        </AnchoredPanel>
      )}
    </div>
  );
}

/**
 * The free-time window: a field reading "6 PM – 9 PM" (or "Any time") that
 * opens a two-thumb range slider — two overlaid `<input type="range">`s sharing
 * one track, with the selected span filled in, spanning the whole day.
 *
 * Dragging both thumbs back to the full span means "any time" (filter off), so
 * the control has an obvious off position instead of needing a separate mode.
 * The thumbs are kept at least an hour apart, so an invalid window is
 * unreachable rather than merely rejected.
 */
function TimeRangeSelect({ startHour, endHour, onChange }: {
  startHour: number | null;
  endHour: number | null;
  onChange: (startHour: number | null, endHour: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const active = startHour != null;
  const start = startHour ?? RANGE_MIN;
  const end = endHour ?? RANGE_MAX;
  const label = active ? `${hourLabel(start)} – ${hourLabel(end)}` : 'Any time';

  // Emit null/null for the full span so "any time" is a real slider position.
  const emit = (s: number, e: number) => {
    if (s <= RANGE_MIN && e >= RANGE_MAX) onChange(null, null);
    else onChange(s, e);
  };
  const pct = (h: number) => ((h - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;

  return (
    <div className="nv-select nv-time" ref={ref}>
      <button
        type="button"
        className={`nv-select-btn${active ? ' active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Free between: ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="nv-time-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
        <span className="nv-select-val">{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <AnchoredPanel anchorRef={ref} className="nv-time-pop" minWidth={268} role="dialog" aria-label="Free between">
          <div className="nv-time-pop-head">
            <span className="nv-timebar-label">Free between</span>
            <span className={`nv-timebar-value${active ? ' active' : ''}`}>{label}</span>
          </div>

          <div className={`nv-range${active ? ' active' : ''}`}>
            <span className="nv-range-track" aria-hidden="true" />
            <span
              className="nv-range-fill"
              style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
              aria-hidden="true"
            />
            <input
              type="range"
              className="nv-range-input start"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={1}
              value={start}
              // Never let the thumbs cross: the start stops an hour short of the end.
              onChange={(e) => emit(Math.min(Number(e.target.value), end - 1), end)}
              aria-label="Free from"
              aria-valuetext={hourLabel(start)}
            />
            <input
              type="range"
              className="nv-range-input end"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={1}
              value={end}
              onChange={(e) => emit(start, Math.max(Number(e.target.value), start + 1))}
              aria-label="Free until"
              aria-valuetext={hourLabel(end)}
            />
          </div>

          <div className="nv-range-ticks" aria-hidden="true">
            <span>{hourLabel(RANGE_MIN)}</span>
            <span>12 NN</span>
            <span>{hourLabel(RANGE_MAX)}</span>
          </div>

          <div className="nv-time-pop-foot">
            <button
              type="button"
              className="nv-timebar-clear"
              disabled={!active}
              onClick={() => onChange(null, null)}
            >
              Reset
            </button>
            <button type="button" className="nv-time-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </AnchoredPanel>
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
  /** Venues confirmed free across the window — shown only while it's set. */
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
      <TimeRangeSelect startHour={startHour} endHour={endHour} onChange={onTimeChange} />
      <FilterSelect
        value={area}
        options={areaOptions}
        onChange={onAreaChange}
        ariaLabel="Filter by area"
        searchable
        searchPlaceholder="Search area…"
      />
      <FilterSelect value={type} options={typeOptions} onChange={onTypeChange} ariaLabel="Filter by court type" />
      {loading && <span className="nv-filter-spin" aria-label="Checking availability" role="status" />}
      {!loading && startHour != null && matchCount != null && (
        <span className="nv-filter-count">{matchCount} free</span>
      )}
    </div>
  );
}
