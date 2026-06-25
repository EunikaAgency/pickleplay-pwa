import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

// Whole-hour time picker. Courts are sold by the hour, so booking/create-game
// schedules only ever need on-the-hour slots. A native <input type="time"> shows
// a minute wheel and a native <select> can't be styled when open — so this is a
// custom control: a styled field that drops a compact, on-brand menu anchored to
// it. The menu is viewport-aware — it flips open upward when there isn't room
// below and caps its height to the space available, so it never runs off-screen.
//
// Self-contained on purpose: shared/ must not import a feature slice, so the 12h
// label formatting is inlined here rather than reused from bookings/bookingDisplay.

interface HourSelectProps {
  /** Selected time as a 24h "HH:00" string. */
  value: string;
  onChange: (value: string) => void;
  /** When set (an "HH:MM" start time), only hours strictly after it are offered — for an end time. */
  after?: string;
  /** Optional: return true for an hour (0–23) that can't be picked — it's hidden from the list (booked / past). */
  disabled?: (hour: number) => boolean;
  /**
   * Richer per-hour classification (takes precedence over `disabled`): `hide`
   * drops the hour entirely; `disabled` shows it greyed and unpickable; `note`
   * is a small tag rendered on a disabled row (e.g. "Booked"). Lets the picker
   * show *why* a slot is gone instead of silently omitting it.
   */
  hourInfo?: (hour: number) => { hide?: boolean; disabled?: boolean; note?: string };
  /** Shown when `value` is empty, so the field can start unset (e.g. an end time awaiting a start). */
  placeholder?: string;
  /** Accessible name for the field. */
  'aria-label'?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DESIRED_MAX = 264; // px — ~7 rows before scrolling

/** 17 → "5:00 PM". */
function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ampm}`;
}

export function HourSelect({ value, onChange, after, disabled, hourInfo, placeholder = 'Select', 'aria-label': label = 'Select time' }: HourSelectProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const [maxH, setMaxH] = useState(DESIRED_MAX);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // The rows to render. With `hourInfo` an hour can be hidden, shown greyed +
  // unpickable (with a note like "Booked"), or selectable — so unavailability is
  // explicit. Without it, fall back to the legacy behavior: hide disabled hours.
  const minHour = after ? Number(after.split(':')[0]) : -1;
  const rows: { hour: number; disabled: boolean; note?: string }[] = [];
  for (let h = 0; h < 24; h++) {
    if (h <= minHour) continue;
    if (hourInfo) {
      const info = hourInfo(h);
      if (info.hide) continue;
      rows.push({ hour: h, disabled: !!info.disabled, note: info.note });
    } else if (!(disabled?.(h) ?? false)) {
      rows.push({ hour: h, disabled: false });
    }
  }

  // An empty value leaves the field unset — it renders the placeholder, not 12:00 AM.
  const hasValue = Boolean(value);
  const selectedHour = hasValue ? Number(value.split(':')[0]) : NaN;

  // Decide placement/height from the live viewport before opening (in the click
  // handler, not an effect, so we don't setState during render commit).
  const openMenu = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 12;
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const down = below >= above; // open toward whichever side has more room
      setPlacement(down ? 'down' : 'up');
      setMaxH(Math.max(140, Math.min(DESIRED_MAX, down ? below : above)));
    }
    setOpen(true);
  };

  // Close on outside-click / Escape, and reveal the current choice on open.
  useEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (h: number) => {
    onChange(`${pad(h)}:00`);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="control flex items-center justify-between text-left"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={hasValue ? '' : 'text-[var(--muted)]'}>
          {hasValue ? hourLabel(selectedHour) : placeholder}
        </span>
        <Icon name="chevron" size={16} className={`text-[var(--muted)] shrink-0 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ maxHeight: maxH }}
          className={`absolute z-50 left-0 right-0 overflow-y-auto rounded-2xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] shadow-lg p-1.5 ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {rows.length === 0 ? (
            <div className="px-3 py-3 text-center text-[14px] font-semibold text-[var(--muted)]">No times available</div>
          ) : (
            rows.map(({ hour: h, disabled: rowDisabled, note }) => {
              const selected = h === selectedHour;
              // A booked/unavailable row is shown greyed + a note, but not pickable —
              // so the player sees *why* the slot is gone instead of it just missing.
              if (rowDisabled) {
                return (
                  <div
                    key={h}
                    role="option"
                    aria-selected={false}
                    aria-disabled
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[15px] font-semibold text-[var(--muted)] opacity-60 cursor-not-allowed"
                  >
                    <span className="line-through">{hourLabel(h)}</span>
                    {note && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--coral-soft)] text-[var(--coral)]">
                        {note}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={h}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(h)}
                  className={`w-full flex items-center px-3 py-2 rounded-xl text-[15px] font-semibold ${
                    selected ? 'bg-[var(--primary)] text-white' : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span>{hourLabel(h)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
