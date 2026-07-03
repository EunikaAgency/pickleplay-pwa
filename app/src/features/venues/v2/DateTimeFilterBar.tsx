import { useRef, useState, useEffect, useCallback } from 'react';
import { CalendarDatePicker } from '../../../shared/components/ui/CalendarDatePicker';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDateShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDateFull(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (n2: number) => String(n2).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isWeekend(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
}

function nextWeekend(ymd: string): string {
  let d = ymd;
  while (!isWeekend(d)) d = addDays(d, 1);
  return d;
}

const AM_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/* ─── Bottom sheet overlay ───────────────────────────────────────────── */

function Sheet({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-dt-sheet', '');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-dt-sheet');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dt-sheet-backdrop" role="dialog" aria-modal="true">
      <div ref={sheetRef} className="dt-sheet">
        <div className="dt-sheet-handle" aria-hidden="true"><span /></div>
        {children}
      </div>
    </div>
  );
}

/* ─── Single hour dropdown (used for start + end independently) ──────── */

function HourDropdown({ initialHour, onApply, onClose, label }: {
  initialHour: number | null;
  onApply: (hour: number) => void;
  onClose: () => void;
  label: string;
}) {
  const init = initialHour ?? new Date().getHours();
  const [am, setAm] = useState(init < 12);
  const [h12, setH12] = useState(init % 12 === 0 ? 12 : init % 12);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const wrapRef = useRef<HTMLDivElement>(null);

  const resolved24 = h12 === 12 ? (am ? 0 : 12) : am ? h12 : h12 + 12;

  const ref = useCallback((el: HTMLDivElement | null) => {
    (wrapRef as any).current = el;
    if (el) {
      const rect = el.parentElement?.getBoundingClientRect();
      if (rect) {
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        setPlacement(below >= above ? 'down' : 'up');
      }
    }
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={`dt-time-drop${placement === 'up' ? ' up' : ''}`} role="dialog">
      <div className="dt-time-label">{label}</div>
      <div className="dt-ampm-row">
        <button type="button" className={`dt-ampm-btn${am ? ' active' : ''}`} onClick={() => setAm(true)}>AM</button>
        <button type="button" className={`dt-ampm-btn${!am ? ' active' : ''}`} onClick={() => setAm(false)}>PM</button>
      </div>
      <div className="dt-hour-grid">
        {AM_HOURS.map((h) => (
          <button
            key={h}
            type="button"
            className={`dt-hour-chip${h12 === h ? ' selected' : ''}`}
            onClick={() => setH12(h)}
          >
            {h}:00
          </button>
        ))}
      </div>
      <div className="dt-time-actions">
        <button type="button" className="dt-time-btn dt-time-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="dt-time-btn dt-time-apply" onClick={() => onApply(resolved24)}>Apply</button>
      </div>
    </div>
  );
}

/* ─── Date picker panel ──────────────────────────────────────────────── */

function DatePickerPanel({ initialDate, onApply, onCancel }: {
  initialDate: string;
  onApply: (date: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [navKey, setNavKey] = useState(0);
  const [visibleYear, setVisibleYear] = useState(() => Number(initialDate.slice(0, 4)));
  const [visibleMonth, setVisibleMonth] = useState(() => Number(initialDate.slice(5, 7)) - 1);

  const today = localToday();
  const tomorrow = addDays(today, 1);
  const weekend = nextWeekend(today);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setVisibleYear(year);
    setVisibleMonth(month);
  }, []);

  const jump = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const d = new Date(date);
    const day = Math.min(d.getDate(), lastDay);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${year}-${pad(month + 1)}-${pad(day)}`);
    setNavKey((k) => k + 1);
  };

  const prevMonth = () => jump(visibleMonth === 0 ? visibleYear - 1 : visibleYear, visibleMonth === 0 ? 11 : visibleMonth - 1);
  const nextMonth = () => jump(visibleMonth === 11 ? visibleYear + 1 : visibleYear, visibleMonth === 11 ? 0 : visibleMonth + 1);
  const prevYear = () => jump(visibleYear - 1, visibleMonth);
  const nextYear = () => jump(visibleYear + 1, visibleMonth);

  return (
    <>
      <div className="dt-date-readout">{fmtDateFull(date)}</div>

      <div className="dt-shortcuts">
        <button type="button" className="dt-shortcut-chip" onClick={() => setDate(today)}>Today</button>
        <button type="button" className="dt-shortcut-chip" onClick={() => setDate(tomorrow)}>Tomorrow</button>
        <button type="button" className="dt-shortcut-chip" onClick={() => setDate(weekend)}>This Weekend</button>
      </div>

      <div className="dt-monthnav">
        <button type="button" className="dt-monthnav-btn" onClick={prevYear} aria-label="Previous year">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
        <button type="button" className="dt-monthnav-btn" onClick={prevMonth} aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="dt-monthnav-label">
          {new Date(visibleYear, visibleMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" className="dt-monthnav-btn" onClick={nextMonth} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <button type="button" className="dt-monthnav-btn" onClick={nextYear} aria-label="Next year">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 7 18 12 13 17" /><polyline points="6 7 11 12 6 17" />
          </svg>
        </button>
      </div>

      <div className="dt-cal-wrap">
        <CalendarDatePicker
          key={navKey}
          value={date}
          onChange={setDate}
          min={today}
          onMonthChange={handleMonthChange}
        />
      </div>

      <div className="dt-sheet-actions">
        <button type="button" className="dt-sheet-btn dt-sheet-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="dt-sheet-btn dt-sheet-apply" onClick={() => onApply(date)}>Apply</button>
      </div>
    </>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export interface DateTimeFilterBarProps {
  filterDate: string | null;
  filterStartHour: number | null;
  filterEndHour?: number | null;
  onApply: (date: string, startHour: number, endHour?: number) => void;
  onClear: () => void;
  matchCount: number | null;
  loading: boolean;
}

export function DateTimeFilterBar({
  filterDate, filterStartHour, filterEndHour, onApply, onClear, matchCount, loading,
}: DateTimeFilterBarProps) {
  const [draftDate, setDraftDate] = useState(filterDate || localToday());
  const [draftStart, setDraftStart] = useState(
    filterStartHour != null ? `${String(filterStartHour).padStart(2, '0')}:00` : '',
  );
  const [draftEnd, setDraftEnd] = useState(
    filterEndHour != null ? `${String(filterEndHour).padStart(2, '0')}:00` : '',
  );
  const [dateSheet, setDateSheet] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const active = filterDate != null && filterStartHour != null;
  const draftStartNum = draftStart ? Number(draftStart.split(':')[0]) : null;
  const draftEndNum = draftEnd ? Number(draftEnd.split(':')[0]) : null;

  const displayDate = draftDate !== localToday() || filterDate ? fmtDateShort(draftDate) : null;
  const displayStart = draftStart
    ? to12h(draftStart)
    : null;
  const displayEnd = draftEnd
    ? to12h(draftEnd)
    : null;

  const applyAll = () => {
    if (draftStartNum == null) return;
    const end = (draftEndNum != null && draftEndNum > draftStartNum) ? draftEndNum : undefined;
    onApply(draftDate, draftStartNum, end);
    setDateSheet(false);
    setStartOpen(false);
    setEndOpen(false);
  };

  const clearAll = () => {
    onClear();
    setDateSheet(false);
    setStartOpen(false);
    setEndOpen(false);
    setDraftDate(localToday());
    setDraftStart('');
    setDraftEnd('');
  };

  const cancelDate = () => {
    setDraftDate(filterDate || localToday());
    setDateSheet(false);
  };

  const cancelStart = () => {
    setDraftStart(filterStartHour != null ? `${String(filterStartHour).padStart(2, '0')}:00` : '');
    setStartOpen(false);
  };

  const cancelEnd = () => {
    setDraftEnd(filterEndHour != null ? `${String(filterEndHour).padStart(2, '0')}:00` : '');
    setEndOpen(false);
  };

  useEffect(() => {
    setDraftDate(filterDate || localToday());
    setDraftStart(filterStartHour != null ? `${String(filterStartHour).padStart(2, '0')}:00` : '');
    setDraftEnd(filterEndHour != null ? `${String(filterEndHour).padStart(2, '0')}:00` : '');
  }, [filterDate, filterStartHour, filterEndHour]);

  const closeOthers = (which: 'date' | 'start' | 'end') => {
    if (which !== 'date') setDateSheet(false);
    if (which !== 'start') setStartOpen(false);
    if (which !== 'end') setEndOpen(false);
  };

  return (
    <>
      <div className={`dt-filter-bar${active ? ' active' : ''}`}>
        {/* Date pill */}
        <button
          type="button"
          className={`dt-pill${dateSheet ? ' open' : ''}`}
          onClick={() => { closeOthers('date'); setDateSheet(!dateSheet); }}
          aria-label="Pick a date"
          aria-expanded={dateSheet}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className={`dt-pill-label${!displayDate ? ' placeholder' : ''}`}>
            {displayDate || 'Any date'}
          </span>
          <svg className="dt-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Start time pill */}
        <div className="dt-time-wrap">
          <button
            type="button"
            className={`dt-pill${startOpen ? ' open' : ''}`}
            onClick={() => { closeOthers('start'); setStartOpen(!startOpen); }}
            aria-label="Pick start time"
            aria-expanded={startOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={`dt-pill-label${!displayStart ? ' placeholder' : ''}`}>
              {displayStart || 'Start'}
            </span>
            <svg className="dt-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {startOpen && (
            <HourDropdown
              initialHour={draftStartNum}
              onApply={(h) => { setDraftStart(`${String(h).padStart(2, '0')}:00`); setStartOpen(false); }}
              onClose={cancelStart}
              label="Start time"
            />
          )}
        </div>

        {/* End time pill */}
        <div className="dt-time-wrap">
          <button
            type="button"
            className={`dt-pill${endOpen ? ' open' : ''}`}
            onClick={() => { closeOthers('end'); setEndOpen(!endOpen); }}
            aria-label="Pick end time"
            aria-expanded={endOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={`dt-pill-label${!displayEnd ? ' placeholder' : ''}`}>
              {displayEnd || 'End'}
            </span>
            <svg className="dt-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {endOpen && (
            <HourDropdown
              initialHour={draftEndNum}
              onApply={(h) => { setDraftEnd(`${String(h).padStart(2, '0')}:00`); setEndOpen(false); }}
              onClose={cancelEnd}
              label="End time"
            />
          )}
        </div>

        {active ? (
          <>
            <button type="button" className="dt-action dt-apply" onClick={applyAll} disabled={draftStartNum == null}>
              Apply
            </button>
            <button type="button" className="dt-action dt-clear" onClick={clearAll} aria-label="Clear date/time filter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        ) : (
          <button type="button" className="dt-action dt-apply" onClick={applyAll} disabled={draftStartNum == null}>
            Apply
          </button>
        )}

        {loading && (
          <span className="dt-loading" aria-label="Checking availability…">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="dt-spin">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" />
            </svg>
          </span>
        )}

        {active && matchCount != null && !loading && (
          <span className="dt-match-count">{matchCount} venue{matchCount === 1 ? '' : 's'}</span>
        )}
      </div>

      <Sheet open={dateSheet} onClose={cancelDate}>
        <div className="dt-sheet-header">
          <h3 className="dt-sheet-title">Pick a date</h3>
          <button type="button" className="dt-sheet-close" onClick={cancelDate} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <DatePickerPanel
          initialDate={draftDate}
          onApply={(d) => { setDraftDate(d); setDateSheet(false); }}
          onCancel={cancelDate}
        />
      </Sheet>
    </>
  );
}
