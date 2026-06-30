import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { Toast } from '../../../shared/components/ui/Toast';
import { getCourtHours, putCourtHours, type OwnerHourEntry } from '../../../shared/lib/api';

// A self-contained weekly operating-hours editor (open/close per day + optional
// per-block "Hours pricing"). Extracted from the venue Hours tab so each COURT
// can own its schedule — pass a `courtId` and it loads/saves that court's hours
// (which inherit the venue default until first saved). The pricing-window rules
// are mirrored on the API (putCourtHours → invalidPricingDay) so they're enforced
// both ends.

interface WeeklyHoursEditorProps {
  courtId: string;
}

// dayOfWeek is 0=Sunday in the API; display Monday-first.
const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
];

const hhmm = (t?: string) => (t ? String(t).slice(0, 5) : '');

// "12:03" → "12:04" (one minute later) so a pricing window starts right after the
// previous one ends. Used for the time inputs' min bound.
const addMinute = (t: string): string => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const total = h * 60 + m + 1;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// Format a 24h "HH:mm" as "10:00 AM" for the validation notices.
const to12 = (t: string): string => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const ap = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
};

// Clamp a picked time into [min, max] so an out-of-range value can't be set at all.
const clampTime = (val: string, min?: string, max?: string): string => {
  if (!val) return val;
  if (min && val < min) return min;
  if (max && val > max) return max;
  return val;
};

// An extra priced open–close window (the "Hours pricing" rows below each day).
interface PricingBlock {
  openTime: string;
  closeTime: string;
  price: string;
}
interface Row {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  pricing: PricingBlock[];
}

const emptyPricing = (): PricingBlock => ({ openTime: '', closeTime: '', price: '' });
const emptyRow = (): Row => ({ isClosed: false, openTime: '', closeTime: '', pricing: [emptyPricing()] });

// Validate one pricing window against the day's operating hours + the window before
// it. Returns a user-facing notice when out of range, else null. (Mirrored on the
// API in putCourtHours so the rule is enforced both places.)
function pricingIssue(row: Row, i: number): { message: string | null; openBad: boolean; closeBad: boolean } {
  const none = { message: null, openBad: false, closeBad: false };
  const p = row.pricing[i];
  if (!p) return none;
  const prevClose = i > 0 ? row.pricing[i - 1].closeTime : '';
  const openMin = i === 0 ? row.openTime : (prevClose ? addMinute(prevClose) : row.openTime);
  if (p.openTime && openMin && p.openTime < openMin) {
    return {
      message: prevClose
        ? `Open must be ${to12(openMin)} or later — after the previous window.`
        : `Open can't be earlier than the ${to12(openMin)} opening time.`,
      openBad: true, closeBad: false,
    };
  }
  if (p.closeTime && row.closeTime && p.closeTime > row.closeTime) {
    return { message: `Close can't be later than the ${to12(row.closeTime)} closing time.`, openBad: false, closeBad: true };
  }
  if (p.openTime && p.closeTime && p.closeTime <= p.openTime) {
    return { message: 'Close must be after open.', openBad: false, closeBad: true };
  }
  return none;
}

const timeInputClass =
  'h-9 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-2.5 text-[15px] text-[var(--ink)] focus:border-[var(--primary)] outline-none';

// Same time input, but a red border when its value is out of the allowed range.
const tInput = (bad: boolean) =>
  `h-9 rounded-lg border-[0.5px] ${bad ? 'border-[var(--coral)]' : 'border-[var(--hairline)]'} bg-[var(--surface)] px-2.5 text-[15px] text-[var(--ink)] focus:border-[var(--primary)] outline-none`;

export function WeeklyHoursEditor({ courtId }: WeeklyHoursEditorProps) {
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    getCourtHours(courtId)
      .then((value) => {
        if (cancelled) return;
        // First hour row of a day → the primary window; a second row → the second
        // (priced) window below it.
        const byDow: Record<number, Row> = {};
        const count: Record<number, number> = {};
        for (const e of value) {
          const r = byDow[e.dayOfWeek] ?? (byDow[e.dayOfWeek] = { isClosed: false, openTime: '', closeTime: '', pricing: [] });
          if (e.isClosed) { r.isClosed = true; continue; }
          const n = count[e.dayOfWeek] ?? 0;
          if (n === 0) {
            r.openTime = hhmm(e.openTime);
            r.closeTime = hhmm(e.closeTime);
          } else {
            r.pricing.push({ openTime: hhmm(e.openTime), closeTime: hhmm(e.closeTime), price: e.price != null ? String(e.price) : '' });
          }
          count[e.dayOfWeek] = n + 1;
        }
        // Show at least one (empty) pricing row per day. A lone, empty pricing row
        // mirrors the day's operating hours so the owner only needs to add a rate.
        for (const { dow } of DAYS) {
          if (!byDow[dow]) byDow[dow] = emptyRow();
          else if (byDow[dow].pricing.length === 0) byDow[dow].pricing = [emptyPricing()];
          const d = byDow[dow];
          if (!d.isClosed && d.pricing.length === 1 && !d.pricing[0].price.trim() && !d.pricing[0].openTime && !d.pricing[0].closeTime && (d.openTime || d.closeTime)) {
            d.pricing[0] = { ...d.pricing[0], openTime: d.openTime, closeTime: d.closeTime };
          }
        }
        setRows(byDow);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  const get = (dow: number): Row => rows[dow] ?? emptyRow();
  const update = (dow: number, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [dow]: { ...get(dow), ...patch } }));
    setStatus('idle');
  };
  const updatePricing = (dow: number, i: number, patch: Partial<PricingBlock>) =>
    update(dow, { pricing: get(dow).pricing.map((p, pi) => (pi === i ? { ...p, ...patch } : p)) });
  const addPricing = (dow: number) => update(dow, { pricing: [...get(dow).pricing, emptyPricing()] });
  const removePricing = (dow: number, i: number) => update(dow, { pricing: get(dow).pricing.filter((_, pi) => pi !== i) });

  // Editing the day's operating hours keeps a lone, un-priced "Hours pricing" row
  // mirroring those times (auto-fill only — NOT saved). Once the owner sets a rate
  // or adds another row, it stops auto-syncing.
  const updatePrimaryTime = (dow: number, patch: { openTime?: string; closeTime?: string }) => {
    setRows((r) => {
      const cur = r[dow] ?? emptyRow();
      const next: Row = { ...cur, ...patch };
      if (next.pricing.length === 1 && !next.pricing[0].price.trim()) {
        const p = next.pricing[0];
        const mirroring = (!p.openTime && !p.closeTime) || (p.openTime === cur.openTime && p.closeTime === cur.closeTime);
        if (mirroring) next.pricing = [{ ...p, openTime: next.openTime, closeTime: next.closeTime }];
      }
      return { ...r, [dow]: next };
    });
    setStatus('idle');
  };

  const onSave = async () => {
    setStatus('saving');
    const entries: OwnerHourEntry[] = [];
    for (const { dow } of DAYS) {
      const row = get(dow);
      if (row.isClosed) { entries.push({ dayOfWeek: dow, isClosed: true }); continue; }
      // Operating window — one row per day.
      entries.push({ dayOfWeek: dow, isClosed: false, openTime: row.openTime || undefined, closeTime: row.closeTime || undefined });
      // Priced windows — saved when they carry a rate (an un-priced row just mirrors
      // the operating hours, so there's nothing to charge).
      for (const p of row.pricing) {
        if (p.price.trim() === '') continue;
        entries.push({ dayOfWeek: dow, isClosed: false, openTime: p.openTime || undefined, closeTime: p.closeTime || undefined, price: Number(p.price) });
      }
    }
    try {
      await putCourtHours(courtId, entries);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch {
      setStatus('error');
    }
  };

  // Block saving while any open day has an out-of-range pricing window.
  const hasInvalidPricing = DAYS.some(({ dow }) => {
    const r = get(dow);
    return !r.isClosed && r.pricing.some((_, i) => pricingIssue(r, i).message !== null);
  });

  if (loading) {
    return <div className="card p-6 text-center t-sm">Loading hours…</div>;
  }

  return (
    <div>
      <div className="divide-y divide-[var(--hairline)]">
        {DAYS.map(({ dow, label }) => {
          const row = get(dow);
          return (
            <div key={dow} className="py-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 font-bold text-[13px] text-[var(--ink)]">{label}</span>
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  <input type="checkbox" checked={row.isClosed} onChange={(e) => update(dow, { isClosed: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                  Closed
                </label>
                {!row.isClosed && (
                  <div className="flex items-center gap-2">
                    <input type="time" aria-label={`${label} open time`} value={row.openTime} onChange={(e) => updatePrimaryTime(dow, { openTime: e.target.value })} className={timeInputClass} />
                    <span className="text-[var(--muted)]">to</span>
                    <input type="time" aria-label={`${label} close time`} value={row.closeTime} onChange={(e) => updatePrimaryTime(dow, { closeTime: e.target.value })} className={timeInputClass} />
                  </div>
                )}
              </div>
              {!row.isClosed && (
                <div className="card p-2 mt-1.5">
                  <div className="t-eyebrow mb-1.5">Hours pricing</div>
                  <div className="space-y-1.5">
                    {row.pricing.map((p, i) => {
                      // Open can't start before the operating open (first row) or
                      // before the previous window ends + 1 min; close can't pass the
                      // operating close. Keeps the priced windows in order, no overlap.
                      const prevClose = i > 0 ? row.pricing[i - 1].closeTime : '';
                      const openMin = i === 0 ? row.openTime : (prevClose ? addMinute(prevClose) : row.openTime);
                      const closeMin = p.openTime || openMin;
                      const issue = pricingIssue(row, i);
                      return (
                        <div key={`${dow}-${i}`}>
                          {/* One window on a single no-wrap row: the times flex to fill,
                              the rate + ✕ stay pinned at the end so the ✕ never wraps. */}
                          <div className="flex items-center gap-2">
                            <input type="time" aria-label={`${label} pricing ${i + 1} open time`} value={p.openTime} min={openMin || undefined} max={row.closeTime || undefined} onChange={(e) => updatePricing(dow, i, { openTime: clampTime(e.target.value, openMin, row.closeTime) })} className={`${tInput(issue.openBad)} flex-1 min-w-0`} />
                            <span className="text-[var(--muted)] shrink-0">to</span>
                            <input type="time" aria-label={`${label} pricing ${i + 1} close time`} value={p.closeTime} min={closeMin || undefined} max={row.closeTime || undefined} onChange={(e) => updatePricing(dow, i, { closeTime: clampTime(e.target.value, closeMin, row.closeTime) })} className={`${tInput(issue.closeBad)} flex-1 min-w-0`} />
                            <div className="flex items-center gap-1 h-9 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-2 focus-within:border-[var(--primary)] shrink-0">
                              <span className="text-[var(--muted)] text-[14px]">₱</span>
                              <input inputMode="decimal" aria-label={`${label} pricing ${i + 1} rate`} value={p.price} maxLength={7} onChange={(e) => updatePricing(dow, i, { price: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Rate" className="w-12 bg-transparent text-[15px] text-[var(--ink)] outline-none" />
                            </div>
                            {/* Row 0 is the base window (mirrors the day's hours) — not
                                removable; a spacer keeps its columns aligned with the rest. */}
                            {i === 0 ? (
                              <span className="w-7 shrink-0" aria-hidden="true" />
                            ) : (
                              <button type="button" onClick={() => removePricing(dow, i)} aria-label={`Remove ${label} pricing ${i + 1}`} className="w-7 h-9 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] shrink-0">
                                <Icon name="close" size={16} />
                              </button>
                            )}
                          </div>
                          {issue.message && <div className="t-xs text-[var(--coral)] font-bold mt-1">{issue.message}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Add a new priced window — anchored at the bottom of the card. */}
                  <button type="button" onClick={() => addPricing(dow)} className="mt-1.5 w-full h-9 rounded-lg bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] inline-flex items-center justify-center gap-1">
                    <Icon name="plus" size={14} /> Add hour pricing
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {status === 'error' && <div className="t-xs text-[var(--coral)] font-bold mt-2">Couldn't save hours. Try again.</div>}
      {hasInvalidPricing && <div className="t-xs text-[var(--coral)] font-bold mt-2">Fix the highlighted hour-pricing times before saving.</div>}
      <Button fullWidth className="mt-3" onClick={onSave} disabled={status === 'saving' || hasInvalidPricing}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Saved</> : 'Save hours'}
      </Button>
      <Toast message="Hours saved" show={status === 'saved'} />
    </div>
  );
}
