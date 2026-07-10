import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { listCourts, listSlotOverrides, createSlotOverride, deleteSlotOverride, type OwnerCourt } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerPricingScreenProps {
  onBack: () => void;
  onNavigate: Navigate;
}

interface PricingRule {
  id: string;
  name: string;
  shortName: string;
  price: string;
  color: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['12AM', '1AM', '2AM', '3AM', '4AM', '5AM', '6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM', '11PM'];
const COLOR_SWATCHES = ['#f59e0b', '#f97316', '#eab308', '#14b8a6', '#06b6d4', '#3b82f6', '#426383', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#64748b', '#4b5b70'];
const CLOSED_COLOR = '#94a3b8';       // "Clear" — default open, no pricing rule
const CLEAR_TOOL_ID = 'available';
const RESERVED_COLOR = '#22c55e';
const RESERVED_TOOL_ID = 'reserved';
const MAINTENANCE_COLOR = '#d63c43';  // "Maintenance" — blocked slot (calendar counterpart)
const MAINTENANCE_TOOL_ID = 'maintenance';
const SELECTED_VENUE_STORAGE_KEY = 'pb-owner-pricing-selected-venue';

const INITIAL_RULES: PricingRule[] = [
  { id: 'weekday-peak', name: 'Weekday Evening Peak', shortName: 'Peak', price: '350', color: '#f59e0b' },
  { id: 'weekend-prime', name: 'Weekend Prime Slot', shortName: 'Wknd Prime', price: '450', color: '#8b5cf6' },
  { id: 'holiday-special', name: 'Holiday Special', shortName: 'Holiday', price: '500', color: '#f59e0b' },
  { id: 'early-bird', name: 'Early Bird Discount', shortName: 'Early Bird', price: '150', color: '#426383' },
];

const blankRule = (): PricingRule => ({
  id: '',
  name: '',
  shortName: '',
  price: '',
  color: '#f59e0b',
});

const cellKey = (day: string, hour: string) => `${day}:${hour}`;
/** Local YYYY-MM-DD — avoids toISOString()'s UTC shift (saves July 7 as July 6 in PH). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function cellLabel(rule: PricingRule | null, isReserved: boolean, isMaintenance: boolean) {
  if (isReserved) return 'Reserved';
  if (isMaintenance) return 'Maintenance · Blocked';
  return rule ? `${rule.shortName} · ₱${rule.price}` : 'Clear · ₱0';
}

function peso(n: number) {
  return `₱${Math.round(n).toLocaleString()}`;
}

function readSavedVenue() {
  try {
    return window.localStorage.getItem(SELECTED_VENUE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveSelectedVenue(id: string) {
  try {
    if (id) window.localStorage.setItem(SELECTED_VENUE_STORAGE_KEY, id);
    else window.localStorage.removeItem(SELECTED_VENUE_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable; venue selection still works for this session.
  }
}

const MONTH_INDEX: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };

function weekMonday(month: string, weekNum: number, year: number): Date {
  const monthIdx = MONTH_INDEX[month] ?? new Date().getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  const dayOfWeek = firstOfMonth.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return new Date(year, monthIdx, 1 + mondayOffset + (weekNum - 1) * 7);
}

function weekDateRange(month: string, weekNum: number, year: number): string {
  const monday = weekMonday(month, weekNum, year);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return monday.getMonth() === sunday.getMonth()
    ? `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`
    : `${fmt(monday)} – ${fmt(sunday)}`;
}

/** calendar week numbers (1-5) whose Monday falls in the selected month. */
function monthWeekNums(month: string, year: number): number[] {
  const nums: number[] = [];
  const monthIdx = MONTH_INDEX[month] ?? new Date().getMonth();
  for (let w = 1; w <= 5; w++) {
    if (weekMonday(month, w, year).getMonth() === monthIdx) nums.push(w);
  }
  return nums;
}

/** Contiguous time blocks for a single day from painted cells. */
function dayBlocks(day: string, cells: Record<string, string>, rules: PricingRule[]): { openTime: string; closeTime: string; price: number; ruleId?: string; note?: string }[] {
  const blocks: { openTime: string; closeTime: string; price: number; ruleId?: string; note?: string }[] = [];
  const ruleMap = new Map(rules.map((r) => [r.id, r]));
  const cellVal = (hour: number) => cells[cellKey(day, HOURS[hour])] ?? '';
  let hour = 0;
  while (hour < 24) {
    const val = cellVal(hour);
    if (!val) { hour++; continue; }
    // Maintenance = red cells, saved with price 0 + note "Maintenance".
    if (val === MAINTENANCE_TOOL_ID) {
      let endHour = hour + 1;
      while (endHour < 24 && cellVal(endHour) === MAINTENANCE_TOOL_ID) endHour++;
      blocks.push({ openTime: `${String(hour).padStart(2, '0')}:00`, closeTime: `${String(endHour).padStart(2, '0')}:00`, price: 0, note: 'Maintenance' });
      hour = endHour;
      continue;
    }
    // Reserved — saved with price 0 + note "Reserved".
    if (val === RESERVED_TOOL_ID) {
      let endHour = hour + 1;
      while (endHour < 24 && cellVal(endHour) === RESERVED_TOOL_ID) endHour++;
      blocks.push({ openTime: `${String(hour).padStart(2, '0')}:00`, closeTime: `${String(endHour).padStart(2, '0')}:00`, price: 0, note: 'Reserved' });
      hour = endHour;
      continue;
    }
    // Pricing rule
    const rule = ruleMap.get(val);
    if (!rule) { hour++; continue; }
    const price = Number(rule.price) || 0;
    let endHour = hour + 1;
    while (endHour < 24 && cellVal(endHour) === val) endHour++;
    blocks.push({ openTime: `${String(hour).padStart(2, '0')}:00`, closeTime: `${String(endHour).padStart(2, '0')}:00`, price, ruleId: val });
    hour = endHour;
  }
  return blocks;
}


export function OwnerPricingScreen({ onBack, onNavigate }: OwnerPricingScreenProps) {
  const { venues, status } = useOwnerDashboard({ withAnalytics: false });
  const [venue, setVenue] = useState(readSavedVenue);
  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [rules, setRules] = useState<PricingRule[]>(INITIAL_RULES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PricingRule>(blankRule());
  const [activeRuleId, setActiveRuleId] = useState(INITIAL_RULES[0]?.id ?? CLEAR_TOOL_ID);
  // Per‑week painted cells, keyed by the week's Monday date (YYYY‑MM‑DD).
  const [cellsByWeek, setCellsByWeek] = useState<Record<string, Record<string, string>>>({});
  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()]);
  const [week, setWeek] = useState(1);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [dirtyWeeks, setDirtyWeeks] = useState<Record<string, boolean>>({});
  const [summaryOpen, setSummaryOpen] = useState(true);
  const isPaintingRef = useRef(false);
  const paintToolRef = useRef(activeRuleId);
  const paintedDuringDragRef = useRef<Set<string>>(new Set());

  const year = useMemo(() => new Date().getFullYear(), []);
  const weekNums = useMemo(() => monthWeekNums(month, year), [month, year]);

  // Week key = Monday date string, unique per calendar week.
  const weekKey = useMemo(() => {
    const m = weekMonday(month, week, year);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
  }, [month, week, year]);

  // All-court rules are venue-wide defaults; specific court views inherit them
  // and can paint court-specific blocks on top.
  const baseScopeKey = `${weekKey}|all`;
  const scopeKey = `${weekKey}|${selectedCourtId || 'all'}`;

  const selectedScopeCells = cellsByWeek[scopeKey] || {};
  const venueWideCells = cellsByWeek[baseScopeKey] || {};
  const paintedCells = selectedCourtId ? { ...venueWideCells, ...selectedScopeCells } : selectedScopeCells;
  const isDirty = !!dirtyWeeks[scopeKey];
  const markDirty = () => setDirtyWeeks((prev) => (prev[scopeKey] ? prev : { ...prev, [scopeKey]: true }));

  // When switching months, reset week to first available if current is invalid.
  useEffect(() => {
    if (!weekNums.includes(week)) setWeek(weekNums[0] || 1);
  }, [weekNums, week]);

  useEffect(() => {
    if (venues.length === 0) return;
    const venueIds = venues.map((v) => v.slug || v.id);
    if (venue && venueIds.includes(venue)) return;
    const savedVenue = readSavedVenue();
    const nextVenue = savedVenue && venueIds.includes(savedVenue) ? savedVenue : venueIds[0];
    setVenue(nextVenue);
    saveSelectedVenue(nextVenue);
  }, [venue, venues]);

  useEffect(() => {
    const SPECIALS = new Set([CLEAR_TOOL_ID, MAINTENANCE_TOOL_ID]);
    if (!SPECIALS.has(activeRuleId) && rules.length > 0 && !rules.some((rule) => rule.id === activeRuleId)) setActiveRuleId(CLEAR_TOOL_ID);
  }, [activeRuleId, rules]);

  useEffect(() => {
    const remap = new Map<string, string>();
    for (const rule of rules) {
      if (!rule.id.startsWith('loaded-')) continue;
      const canonical = rules.find((candidate) => candidate.id !== rule.id && !candidate.id.startsWith('loaded-') && Number(candidate.price) === Number(rule.price));
      if (canonical) remap.set(rule.id, canonical.id);
    }
    if (remap.size === 0) return;
    setRules((list) => list.filter((rule) => !remap.has(rule.id)));
    setCellsByWeek((prev) => Object.fromEntries(
      Object.entries(prev).map(([weekId, weekCells]) => [
        weekId,
        Object.fromEntries(Object.entries(weekCells).map(([key, ruleId]) => [key, remap.get(ruleId) ?? ruleId])),
      ]),
    ));
    setActiveRuleId((id) => remap.get(id) ?? id);
  }, [rules]);

  useEffect(() => {
    setCellsByWeek({});
    setDirtyWeeks({});
    setSaveStatus('idle');
    setSaveError('');
  }, [venue]);

  useEffect(() => {
    if (!venue) { setCourts([]); setSelectedCourtId(''); return; }
    let cancelled = false;
    setCourtsLoading(true);
    listCourts(venue)
      .then((list) => { if (!cancelled) { setCourts(list); setSelectedCourtId(''); } })
      .catch(() => { if (!cancelled) setCourts([]); })
      .finally(() => { if (!cancelled) setCourtsLoading(false); });
    return () => { cancelled = true; };
  }, [venue]);

  // Load slot overrides for ALL scopes (all courts + each specific court) so the
  // summary always has complete data regardless of which court is selected.
  useEffect(() => {
    if (!venue) return;
    // Determine which scopes to load — all courts + the "all" scope.
    const scopes = ['all', ...courts.map((c) => c.id)];
    const wk = weekKey;
    const monday = weekMonday(month, week, year);
    let cancelled = false;

    Promise.all(Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      return listSlotOverrides(venue, ymd(date));
    })).then((results) => {
      if (cancelled) return;
      const updates: Record<string, Record<string, string>> = {};
      const newRuleMap = new Map<number, PricingRule>();
      let ruleIdx = 0;
      for (const scope of scopes) {
        const sk = `${wk}|${scope}`;
        if (cellsByWeek[sk] && Object.keys(cellsByWeek[sk]).length > 0) continue; // already painted
        const allCells: Record<string, string> = {};
        for (let d = 0; d < 7; d++) {
          const dayLabel = DAYS[d];
          for (const ov of results[d]) {
            // Match override to scope: "all" → courtId null, specific → courtId match.
            if (scope === 'all' ? ov.courtId != null : ov.courtId !== scope) continue;
            const startH = parseInt(ov.startTime.slice(0, 2), 10);
            const endH = parseInt(ov.endTime.slice(0, 2), 10);
            if (isNaN(startH) || isNaN(endH)) continue;
            // Maintenance / Reserved overrides → paint red/green, not pricing rules.
            if (ov.note === 'Maintenance' || ov.note === 'Reserved') {
              const toolId = ov.note === 'Reserved' ? RESERVED_TOOL_ID : MAINTENANCE_TOOL_ID;
              for (let h = startH; h < endH; h++) allCells[cellKey(dayLabel, HOURS[h])] = toolId;
              continue;
            }
            let rule = rules.find((r) => Number(r.price) === ov.price) ?? newRuleMap.get(ov.price);
            if (!rule) {
              ruleIdx++;
              rule = { id: `loaded-${ov.price}-${ruleIdx}`, name: `₱${ov.price}/hr`, shortName: `₱${ov.price}`, price: String(ov.price), color: COLOR_SWATCHES[(ruleIdx - 1) % COLOR_SWATCHES.length] };
              newRuleMap.set(ov.price, rule);
            }
            for (let h = startH; h < endH; h++) allCells[cellKey(dayLabel, HOURS[h])] = rule.id;
          }
        }
        updates[sk] = allCells;
      }
      setCellsByWeek((prev) => ({ ...prev, ...updates }));
      if (newRuleMap.size > 0) {
        setRules((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const unique = [...newRuleMap.values()].filter((r) => !existingIds.has(r.id));
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
      }
    }).catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [venue, courts, weekKey]);

  const hasVenues = venues.length > 0;
  const isEditing = editingId !== null;
  const formOpen = editingId !== null;

  const selectVenue = (id: string) => {
    setVenue(id);
    saveSelectedVenue(id);
  };

  const paintCellKey = (key: string, toolId = activeRuleId) => {
    const sk = scopeKey;
    const SPECIALS = new Set([CLEAR_TOOL_ID, MAINTENANCE_TOOL_ID]);
    if (!SPECIALS.has(toolId) && !rules.some((rule) => rule.id === toolId)) return;
    // Available = clear the cell back to default (no rule, no special marker).
    if (toolId === CLEAR_TOOL_ID) {
      setCellsByWeek((prev) => {
        const cur = { ...(prev[sk] || {}) };
        delete cur[key];
        return { ...prev, [sk]: cur };
      });
      markDirty();
      return;
    }
    setCellsByWeek((prev) => {
      const cur = { ...(prev[sk] || {}) };
      cur[key] = toolId;
      return { ...prev, [sk]: cur };
    });
    markDirty();
  };

  const paintCell = (day: string, hour: string) => {
    paintCellKey(cellKey(day, hour));
  };

  const ruleForCell = (day: string, hour: string) => {
    const ruleId = paintedCells[cellKey(day, hour)];
    return rules.find((rule) => rule.id === ruleId) ?? null;
  };

  const paintDragTarget = (target: Element | null) => {
    const cell = target?.closest('[data-pricing-cell-key]') as HTMLElement | null;
    const key = cell?.dataset.pricingCellKey;
    if (!key || paintedDuringDragRef.current.has(key)) return;
    paintedDuringDragRef.current.add(key);
    paintCellKey(key, paintToolRef.current);
  };

  const startCellPaint = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    isPaintingRef.current = true;
    paintToolRef.current = activeRuleId;
    paintedDuringDragRef.current = new Set();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    paintDragTarget(event.currentTarget);
  };

  const moveCellPaint = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPaintingRef.current) return;
    event.preventDefault();
    paintDragTarget(document.elementFromPoint(event.clientX, event.clientY));
  };

  const stopCellPaint = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPaintingRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    isPaintingRef.current = false;
    paintedDuringDragRef.current = new Set();
  };

  const paintKeys = (keys: string[]) => {
    const sk = scopeKey;
    const allActive = activeRuleId !== CLEAR_TOOL_ID && keys.every((key) => (paintedCells[key] ?? '') === activeRuleId);
    const shouldClear = activeRuleId === CLEAR_TOOL_ID || allActive;
    setCellsByWeek((prev) => {
      const cur = { ...(prev[sk] || {}) };
      for (const key of keys) {
        if (shouldClear) delete cur[key];
        else cur[key] = activeRuleId;
      }
      return { ...prev, [sk]: cur };
    });
    markDirty();
  };

  const paintDayRow = (day: string) => {
    paintKeys(HOURS.map((hour) => cellKey(day, hour)));
  };

  const paintHourColumn = (hour: string) => {
    paintKeys(DAYS.map((day) => cellKey(day, hour)));
  };

  const paintedRuleIds = Object.values(paintedCells).filter((id) => id !== RESERVED_TOOL_ID && id !== MAINTENANCE_TOOL_ID);
  const paidHours = paintedRuleIds.length;
  const weeklyRevenueEstimate = paintedRuleIds.reduce((sum, ruleId) => {
    const rule = rules.find((r) => r.id === ruleId);
    return sum + (Number(rule?.price) || 0);
  }, 0);

  const showCellTooltip = (target: HTMLElement, label: string) => {
    const rect = target.getBoundingClientRect();
    setTooltip({ label, x: rect.left + rect.width / 2, y: rect.top });
  };

  const openAdd = () => {
    setEditingId('new');
    setDraft({ ...blankRule(), shortName: 'Prime' });
  };

  const openEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setDraft(rule);
  };

  const closeForm = () => {
    setEditingId(null);
    setDraft(blankRule());
  };

  const saveRule = () => {
    const name = draft.name.trim();
    const shortName = draft.shortName.trim();
    const price = draft.price.replace(/[^\d.]/g, '');
    if (!name || !shortName || !price) return;
    const next: PricingRule = {
      ...draft,
      id: editingId === 'new' ? `rule-${Date.now()}` : draft.id,
      name,
      shortName,
      price,
    };
    setRules((list) => (editingId === 'new' ? [...list, next] : list.map((rule) => (rule.id === next.id ? next : rule))));
    setActiveRuleId(next.id);
    closeForm();
  };

  const deleteRule = (id: string) => {
    const deleted = rules.find((rule) => rule.id === id);
    const replacement = deleted ? rules.find((rule) => rule.id !== id && Number(rule.price) === Number(deleted.price)) : null;
    if (replacement) {
      setCellsByWeek((prev) => Object.fromEntries(
        Object.entries(prev).map(([weekId, weekCells]) => [
          weekId,
          Object.fromEntries(Object.entries(weekCells).map(([key, ruleId]) => [key, ruleId === id ? replacement.id : ruleId])),
        ]),
      ));
    }
    setRules((list) => list.filter((rule) => rule.id !== id));
    if (activeRuleId === id) setActiveRuleId(replacement?.id ?? CLEAR_TOOL_ID);
    if (editingId === id) closeForm();
  };

  const handleSave = async () => {
    if (!venue || saveStatus === 'saving' || courts.length === 0) return;
    setSaveStatus('saving');
    setSaveError('');
    try {
      // Save every week+court scope that has painted cells, plus dirty
      // scopes that were cleared so old persisted overrides are removed.
      for (const [sk, weekCells] of Object.entries(cellsByWeek)) {
        if (Object.keys(weekCells).length === 0 && !dirtyWeeks[sk]) continue;
        const [datePart, courtPart] = sk.split('|');
        const monday = new Date(datePart + 'T00:00:00');
        const scopeCourtId = courtPart === 'all' ? undefined : courtPart;
        for (let d = 0; d < 7; d++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + d);
          const dateStr = ymd(date);
          // Delete only overrides matching this court scope.
          const existing = await listSlotOverrides(venue, dateStr);
          const toDelete = existing.filter((ov) => scopeCourtId ? ov.courtId === scopeCourtId : ov.courtId == null);
          await Promise.all(toDelete.map((ov) => deleteSlotOverride(ov.id)));
          const blocks = dayBlocks(DAYS[d], weekCells, rules);
          for (const block of blocks) {
            await createSlotOverride(venue, {
              courtId: scopeCourtId || undefined,
              date: dateStr,
              startTime: block.openTime,
              endTime: block.closeTime,
              price: block.price,
              note: block.note,
            });
          }
        }
      }
      setDirtyWeeks({});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Unknown error');
      setTimeout(() => { setSaveStatus('idle'); setSaveError(''); }, 4000);
    }
  };

  return (
    <div className="scroll owner-pricing-screen safe-top safe-bottom bg-[var(--bg)]">
      <div className="owner-pricing-content px-5 pt-4 sm:px-0 sm:pt-0">
        <div className="bg-[var(--surface)] text-[var(--ink)] rounded-[8px] sm:rounded-none px-3 py-2.5 border border-[var(--hairline)] sm:border-x-0 sm:border-t-0 shadow-[var(--shadow-card)] sm:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex items-start gap-2">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="mt-0.5 h-7 w-7 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] sm:hidden flex items-center justify-center shrink-0"
              >
                <Icon name="chevron" size={18} className="rotate-180" />
              </button>
              <div className="min-w-0">
                <div className="font-heading font-extrabold text-[17px] leading-tight">Pricing Override</div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">Paint time blocks with pricing rules, then save</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {status !== 'loading' && !hasVenues && (
                <button
                  type="button"
                  onClick={() => onNavigate('owner-venues')}
                  className="h-9 w-full sm:w-auto px-4 rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] text-[12px] font-extrabold text-[#f59e0b] text-left sm:text-center"
                >
                  No venue yet. Add or Claim a Venue
                </button>
              )}
              <select
                value={venue}
                onChange={(e) => selectVenue(e.target.value)}
                aria-label="Venue"
                disabled={!hasVenues || status === 'loading'}
                className={status !== "loading" && !hasVenues ? "hidden" : "h-9 w-full min-w-0 sm:w-auto sm:min-w-[156px] rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--ink)] outline-none disabled:opacity-70"}
              >
                {status === 'loading' && <option value="">Loading venues...</option>}
                {status !== 'loading' && !hasVenues && <option value="">No venues yet</option>}
                {venues.map((v) => {
                  const id = v.slug || v.id;
                  return <option key={id} value={id}>{v.displayName || 'Venue'}</option>;
                })}
              </select>
              {venue && courts.length > 0 && (
                <select
                  value={selectedCourtId}
                  onChange={(e) => setSelectedCourtId(e.target.value)}
                  aria-label="Court"
                  className="h-9 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--ink)] outline-none"
                >
                  <option value="">All courts</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.courtNumber}{c.courtName ? ` — ${c.courtName}` : ''}</option>
                  ))}
                </select>
              )}
              {venue && !courtsLoading && courts.length === 0 && (
                <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">
                  No courts yet.{' '}
                  <button type="button" onClick={() => onNavigate('owner-venue', { id: venue, tab: 'courts' })} className="font-bold text-[#f59e0b] underline">
                    Add a court
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === 'saving' || !venue || !hasVenues || courts.length === 0}
                style={status !== 'loading' && !hasVenues ? { display: 'none' } : undefined}
                className={`h-9 w-full sm:w-auto px-4 rounded-[4px] text-[12px] font-extrabold shadow-sm active:scale-[0.98] shrink-0 disabled:opacity-60 ${
                  saveStatus === 'error' ? 'bg-[var(--coral)] text-white' : 'bg-[#f59e0b] text-[#111827]'
                }`}
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? `Save failed${saveError ? ` — ${saveError}` : ''}` : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>

        <div className={status !== "loading" && !hasVenues ? "hidden" : "mt-4 space-y-4"}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Paid Hours / Week" value={String(paidHours)} tone="amber" />
            <Metric label="Weekly Revenue Estimate" value={peso(weeklyRevenueEstimate)} />
            <Metric label="Pricing Rules" value={String(rules.length)} tone="green" />
          </div>

          {formOpen && (
            <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center bg-black/45 px-4 py-6" role="dialog" aria-modal="true" aria-label={isEditing && editingId !== 'new' ? 'Edit rule' : 'Add rule'}>
              <div className="w-full max-w-[560px] rounded-t-[18px] sm:rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] shadow-xl animate-slide-up">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
                  <div className="font-heading font-extrabold text-[15px] text-[var(--ink)]">{isEditing && editingId !== 'new' ? 'Edit rule' : 'Add rule'}</div>
                  <button type="button" onClick={closeForm} aria-label="Close rule editor" className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]">
                    <Icon name="close" size={16} />
                  </button>
                </div>

                <div className="px-4 py-4 space-y-3">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Rule name</span>
                    <input value={draft.name} onChange={(e) => setDraft((r) => ({ ...r, name: e.target.value }))} className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="Weekday Evening Peak" />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Paint label</span>
                    <input value={draft.shortName} onChange={(e) => setDraft((r) => ({ ...r, shortName: e.target.value }))} className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="Peak" maxLength={14} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Rule price</span>
                    <input value={draft.price} onChange={(e) => setDraft((r) => ({ ...r, price: e.target.value.replace(/[^\d.]/g, '') }))} inputMode="decimal" className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="350" />
                  </label>
                  <div>
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-2">Rule color</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Use ${color}`}
                          onClick={() => setDraft((r) => ({ ...r, color }))}
                          className={`w-8 h-8 rounded-[6px] border ${draft.color === color ? 'border-[var(--ink)] ring-2 ring-[#f59e0b]/30' : 'border-[var(--field-border)]'}`}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--hairline)]">
                  <button type="button" onClick={closeForm} className="h-9 px-3 rounded-[4px] border border-[var(--field-border)] text-[12px] font-bold text-[var(--muted)]">Cancel</button>
                  <button type="button" onClick={saveRule} className="h-9 px-4 rounded-[4px] bg-[#f59e0b] text-[#111827] text-[12px] font-extrabold">Save rule</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="font-bold uppercase tracking-wide">Paint tool:</span>
            {rules.map((rule) => {
              const active = activeRuleId === rule.id;
              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setActiveRuleId(rule.id)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-[4px] border font-extrabold bg-[var(--surface)] ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? rule.color : 'transparent', color: active ? rule.color : 'var(--muted)' }}
                >
                  <span className="inline-block w-2 h-2 rounded-[2px] mr-2" style={{ background: rule.color }} /> {rule.shortName} · ₱{rule.price}
                </button>
              );
            })}
            {(() => {
              const active = activeRuleId === MAINTENANCE_TOOL_ID;
              return (
                <button
                  type="button"
                  onClick={() => setActiveRuleId(MAINTENANCE_TOOL_ID)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-[4px] border font-extrabold bg-[var(--surface)] ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? MAINTENANCE_COLOR : 'transparent', color: active ? MAINTENANCE_COLOR : 'var(--muted)' }}
                >
                  <span className="inline-block w-2 h-2 rounded-[2px] mr-2" style={{ background: MAINTENANCE_COLOR }} /> Maintenance
                </button>
              );
            })()}
            {(() => {
              const active = activeRuleId === CLEAR_TOOL_ID;
              return (
                <button
                  type="button"
                  onClick={() => setActiveRuleId(CLEAR_TOOL_ID)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-[4px] border font-extrabold bg-[var(--surface)] ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? CLOSED_COLOR : 'transparent', color: active ? CLOSED_COLOR : 'var(--muted)' }}
                >
                  <span className="inline-block w-2 h-2 rounded-[2px] mr-2" style={{ background: CLOSED_COLOR }} /> Clear
                </button>
              );
            })()}
            <span className="ml-1">Click or drag to paint blocks</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[8px] border border-[var(--field-border)] bg-[var(--surface)] px-3 py-3 shadow-sm">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Schedule window</div>
              <div className="text-[13px] font-extrabold text-[var(--ink)] mt-0.5">{weekDateRange(month, week, year)}</div>
            </div>
            {isDirty ? (
              <div className="text-[12px] font-bold text-[#f59e0b]">Save before switching weeks</div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Select month"
                  className="h-9 min-w-0 rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-bold text-[var(--ink)] outline-none"
                >
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
                  value={String(week)}
                  onChange={(e) => setWeek(Number(e.target.value))}
                  aria-label="Select week"
                  className="h-9 min-w-0 rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-bold text-[var(--ink)] outline-none"
                >
                  {weekNums.map((wn, i) => <option key={wn} value={wn}>Week {i + 1}: {weekDateRange(month, wn, year)}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-[8px] border border-[var(--field-border)] bg-[var(--surface)] shadow-sm">
            <div className="min-w-[1414px]">
              <div className="grid grid-cols-[56px_repeat(24,minmax(52px,1fr))] border-b border-[var(--field-border)] text-[11px] text-[var(--muted)]">
                <div className="sticky left-0 z-20 px-2 py-3 border-r border-[var(--field-border)] bg-[var(--surface)]">Day</div>
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => paintHourColumn(hour)}
                    title={`${hour} column`}
                    className="px-1 py-3 text-center border-r border-[var(--field-border)] last:border-r-0 hover:bg-[var(--surface-2)]"
                  >
                    {hour}
                  </button>
                ))}
              </div>
              {DAYS.map((day) => (
                <div key={day} className="grid grid-cols-[56px_repeat(24,minmax(52px,1fr))] border-b border-[var(--field-border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => paintDayRow(day)}
                    title={`${day} row`}
                    className="sticky left-0 z-10 px-2 py-2 text-left text-[12px] text-[var(--ink)] border-r border-[var(--field-border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] font-medium"
                  >
                    {day}
                  </button>
                  {HOURS.map((hour) => {
                    const cellVal = paintedCells[cellKey(day, hour)] ?? '';
                    const isReserved = cellVal === RESERVED_TOOL_ID;
                    const isMaintenance = cellVal === MAINTENANCE_TOOL_ID;
                    const rule = ruleForCell(day, hour);
                    const label = cellLabel(rule, isReserved, isMaintenance);
                    const bg = isReserved ? RESERVED_COLOR : isMaintenance ? MAINTENANCE_COLOR : (rule?.color ?? CLOSED_COLOR);
                    return (
                      <button
                        key={`${day}-${hour}`}
                        type="button"
                        aria-label={`${day} ${hour} ${label}`}
                        title={`${day} ${hour} · ${label}`}
                        data-pricing-cell-key={cellKey(day, hour)}
                        onClick={() => paintCell(day, hour)}
                        onPointerDown={startCellPaint}
                        onPointerMove={moveCellPaint}
                        onPointerUp={stopCellPaint}
                        onPointerCancel={stopCellPaint}
                        onMouseEnter={(e) => showCellTooltip(e.currentTarget, label)}
                        onMouseLeave={() => setTooltip(null)}
                        className="relative touch-none select-none p-1 border-r border-[var(--field-border)] last:border-r-0"
                      >
                        <span className="block h-4 rounded-[2px]" style={{ background: bg }} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
            {rules.map((rule) => <Legend key={rule.id} color={rule.color} label={`${rule.shortName} - ₱${rule.price}/hr`} />)}
            <Legend color={MAINTENANCE_COLOR} label="Maintenance · Blocked" />
            <Legend color={CLOSED_COLOR} label="Clear · Open (default)" />
          </div>

          <div className="rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
              <div className="font-heading font-extrabold text-[14px] text-[var(--ink)]">Active Override Rules</div>
              <button type="button" onClick={openAdd} className="text-[11px] font-extrabold text-[#f59e0b]">+ Add Rule</button>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--hairline)] last:border-b-0">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: rule.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-[var(--ink)] leading-tight truncate">{rule.name}</div>
                </div>
                <div className="text-[13px] font-extrabold shrink-0" style={{ color: rule.color }}>₱{rule.price}/hr</div>
                <button type="button" onClick={() => openEdit(rule)} className="h-7 px-2 rounded-[4px] border border-[var(--field-border)] text-[11px] text-[var(--muted)]">Edit</button>
                <button type="button" onClick={() => deleteRule(rule.id)} className="h-7 px-2 rounded-[4px] border border-red-500/50 text-[11px] text-red-500">Delete</button>
              </div>
            ))}
          </div>

          {/* Pricing summary — all courts, specific courts exclude blocks already on All courts */}
          {venue && (() => {
            const entries = Object.entries(cellsByWeek);
            const courtMap = new Map<string, string>();
            courtMap.set('all', 'All courts');
            for (const c of courts) courtMap.set(c.id, c.courtName || `Court ${c.courtNumber}`);
            const byCourt: Map<string, { label: string; blocks: { day: string; time: string; rule: PricingRule }[] }[]> = new Map();
            for (const [, label] of courtMap) byCourt.set(label, []);
            // Collect All courts blocks first so we can subtract them from specific courts.
            const allCoverageByWeek = new Map<string, Map<string, string>>();
            const hourOf = (time: string) => parseInt(time.slice(0, 2), 10);
            for (const [sk, weekCells] of entries) {
              if (Object.keys(weekCells).length === 0) continue;
              const [datePart, courtPart] = sk.split('|');
              if (courtPart !== 'all') continue;
              const monday = new Date(datePart + 'T00:00:00');
              const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
              const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const weekLabel = `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`;
              if (!allCoverageByWeek.has(weekLabel)) allCoverageByWeek.set(weekLabel, new Map());
              const coverage = allCoverageByWeek.get(weekLabel)!;
              for (const day of DAYS) {
                for (const b of dayBlocks(day, weekCells, rules)) {
                  if (!b.ruleId) continue;
                  for (let h = hourOf(b.openTime); h < hourOf(b.closeTime); h++) coverage.set(`${day}|${h}`, b.ruleId);
                }
              }
            }
            for (const [sk, weekCells] of entries) {
              if (Object.keys(weekCells).length === 0) continue;
              const [datePart, courtPart] = sk.split('|');
              const monday = new Date(datePart + 'T00:00:00');
              const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
              const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const weekLabel = `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`;
              const courtLabel = courtMap.get(courtPart);
              if (!courtLabel) continue;
              const weeks = byCourt.get(courtLabel);
              if (!weeks) continue;
              let weekEntry = weeks.find((w) => w.label === weekLabel);
              if (!weekEntry) { weekEntry = { label: weekLabel, blocks: [] }; weeks.push(weekEntry); }
              const inherited = courtPart !== 'all' ? allCoverageByWeek.get(weekLabel) : null;
              for (const day of DAYS) {
                for (const b of dayBlocks(day, weekCells, rules)) {
                  const startHour = hourOf(b.openTime);
                  const endHour = hourOf(b.closeTime);
                  const coveredByAllCourts = inherited
                    ? Array.from({ length: endHour - startHour }, (_, idx) => startHour + idx).every((h) => inherited.get(`${day}|${h}`) === weekCells[cellKey(day, HOURS[h])])
                    : false;
                  if (coveredByAllCourts) continue;
                  const rule = rules.find((r) => r.id === b.ruleId);
                  if (rule) weekEntry.blocks.push({ day, time: `${b.openTime} – ${b.closeTime}`, rule });
                }
              }
            }
            if (byCourt.size === 0) return null;
            return (
              <div className="rounded-[8px] border-2 border-[var(--field-border)] bg-[var(--surface)] shadow-sm overflow-hidden">
                <button type="button" onClick={() => setSummaryOpen((v) => !v)} className={`w-full px-4 py-3 flex items-center justify-between gap-2 ${summaryOpen ? 'border-b-2 border-[var(--field-border)]' : ''}`}>
                  <div className="font-heading font-extrabold text-[14px] text-[var(--ink)]">Pricing Summary</div>
                  <Icon name="chevron" size={16} className={`text-[var(--muted)] transition-transform ${summaryOpen ? 'rotate-90' : ''}`} />
                </button>
                {summaryOpen && [...byCourt.entries()].map(([courtLabel, weeks]) => (
                  <div key={courtLabel} className="border-b border-[var(--hairline)] last:border-b-0">
                    <div className="px-4 py-2 bg-[var(--surface-2)] text-[13px] font-extrabold text-[var(--ink)]">{courtLabel}</div>
                    {weeks.length === 0 && courtLabel !== 'All courts' ? (
                      <div className="px-4 py-2 text-[12px] text-[var(--muted)]">Uses venue-wide pricing</div>
                    ) : weeks.map((w) => (
                      <div key={w.label} className="px-4 py-1.5 border-t border-[var(--hairline)] first:border-t-0">
                        <div className="text-[11px] font-bold text-[var(--muted)] mb-1">{w.label}</div>
                        {w.blocks.length === 0 ? (
                          <div className="text-[12px] text-[var(--muted)]">—</div>
                        ) : w.blocks.map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-[12px] py-0.5">
                            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: b.rule.color }} />
                            <span className="font-semibold text-[var(--ink)]">{b.day}</span>
                            <span className="text-[var(--muted)]">{b.time}</span>
                            <span className="font-bold" style={{ color: b.rule.color }}>{b.rule.shortName} · ₱{b.rule.price}/hr</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[1600] -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-[4px] bg-[#111827] px-2 py-1 text-[10px] font-bold text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' }) {
  const color = tone === 'amber' ? 'text-[#f59e0b]' : tone === 'green' ? 'text-[#22c55e]' : 'text-[var(--ink)]';
  return (
    <div className="rounded-[6px] border border-[var(--field-border)] bg-[var(--surface)] px-3 py-3 shadow-sm">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-heading font-extrabold text-[17px] leading-tight ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}
