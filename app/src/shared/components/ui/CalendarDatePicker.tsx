import { useState } from 'react';
import { Icon } from './Icon';

interface CalendarDatePickerProps {
  /** Selected date as YYYY-MM-DD. */
  value: string;
  onChange: (ymd: string) => void;
  /** Earliest selectable date (YYYY-MM-DD); earlier days render disabled. */
  min?: string;
  /** Latest selectable date (YYYY-MM-DD); later days render disabled. */
  max?: string;
}

const ymd = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Parse a YYYY-MM-DD string into {year, month}; falls back to the current month. */
function monthOf(value: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1 };
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * A month-grid date picker matching the bookings calendar look — clearer and
 * more tappable than a native `<input type="date">`. Highlights today and the
 * selected day; days outside [min, max] render disabled.
 */
export function CalendarDatePicker({ value, onChange, min, max }: CalendarDatePickerProps) {
  const [view, setView] = useState(() => monthOf(value));
  const { year, month } = view;

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const now = new Date();
  const today = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  const prev = () => setView(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const next = () => setView(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));

  return (
    <div className="rounded-3xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-heading font-bold text-[18px] text-[var(--ink)]">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} aria-label="Previous month" className="w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="chevron" size={16} className="rotate-180" />
          </button>
          <button type="button" onClick={next} aria-label="Next month" className="w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <div key={i} className="text-center text-[12px] font-bold text-[var(--muted)] py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 mt-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = ymd(year, month, day);
          const isSel = key === value;
          const isToday = key === today;
          const disabled = (min != null && key < min) || (max != null && key > max);
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(key)}
                aria-label={key}
                aria-pressed={isSel}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold transition-colors ${
                  disabled ? 'text-[var(--muted)] opacity-35 cursor-not-allowed'
                  : isSel ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                  : isToday ? 'text-[var(--ink)] ring-1 ring-[var(--surface-3)]'
                  : 'text-[var(--ink)] active:scale-95'
                }`}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
