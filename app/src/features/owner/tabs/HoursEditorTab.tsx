import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { Toast } from '../../../shared/components/ui/Toast';
import { OwnerSection } from '../components/OwnerSection';
import {
  getHours,
  putHours,
  getClosures,
  createClosure,
  deleteClosure,
  entityId,
  type OwnerHourEntry,
  type OwnerClosure,
} from '../../../shared/lib/api';

interface HoursEditorTabProps {
  venueId: string;
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
// API in putVenueHours so the rule is enforced both places.)
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
  'h-11 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[16px] text-[var(--ink)] focus:border-[var(--primary)] outline-none';

// Same time input, but a red border when its value is out of the allowed range.
const tInput = (bad: boolean) =>
  `h-11 rounded-xl border-[0.5px] ${bad ? 'border-[var(--coral)]' : 'border-[var(--hairline)]'} bg-[var(--surface)] px-3 text-[16px] text-[var(--ink)] focus:border-[var(--primary)] outline-none`;

export function HoursEditorTab({ venueId }: HoursEditorTabProps) {
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [closures, setClosures] = useState<OwnerClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [cDate, setCDate] = useState('');
  const [cReason, setCReason] = useState('');
  const [cStatus, setCStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    Promise.allSettled([getHours(venueId), getClosures(venueId)]).then(([h, c]) => {
      if (cancelled) return;
      // First hour row of a day → the primary window; a second row → the second
      // (priced) window below it.
      const byDow: Record<number, Row> = {};
      const count: Record<number, number> = {};
      if (h.status === 'fulfilled') {
        for (const e of h.value) {
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
      if (c.status === 'fulfilled') setClosures(c.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

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

  const onSaveHours = async () => {
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
      await putHours(venueId, entries);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch {
      setStatus('error');
    }
  };

  const onAddClosure = async () => {
    if (!cDate) return;
    setCStatus('saving');
    try {
      const created = await createClosure(venueId, { closureDate: cDate, reason: cReason || undefined, isClosedAllDay: true });
      setClosures((list) => [...list, created]);
      setCDate('');
      setCReason('');
      setCStatus('idle');
    } catch {
      setCStatus('error');
    }
  };

  const onDeleteClosure = async (id: string) => {
    const prev = closures;
    setClosures((list) => list.filter((c) => entityId(c) !== id));
    try {
      await deleteClosure(id);
    } catch {
      setClosures(prev);
    }
  };

  const sortedClosures = useMemo(
    () => [...closures].sort((a, b) => (a.closureDate > b.closureDate ? 1 : -1)),
    [closures],
  );

  // Block saving while any open day has an out-of-range pricing window.
  const hasInvalidPricing = DAYS.some(({ dow }) => {
    const r = get(dow);
    return !r.isClosed && r.pricing.some((_, i) => pricingIssue(r, i).message !== null);
  });

  if (loading) {
    return <div className="card p-8 text-center t-sm">Loading hours…</div>;
  }

  return (
    <div className="space-y-4">
      <OwnerSection title="Operating Hours" icon="clock" description="Set open and close times for each day. Toggle Closed for rest days.">
        <div className="divide-y divide-[var(--hairline)]">
          {DAYS.map(({ dow, label }) => {
            const row = get(dow);
            return (
              <div key={dow} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-24 font-bold text-[14px] text-[var(--ink)]">{label}</span>
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
                  <div className="card p-3 mt-2.5">
                    <div className="t-eyebrow mb-2">Hours pricing</div>
                    <div className="space-y-2">
                      {row.pricing.map((p, i) => {
                        // Open can't start before the operating open (first row) or
                        // before the previous window ends + 1 min; close can't pass the
                        // operating close. Keeps the priced windows in order, no overlap.
                        const prevClose = i > 0 ? row.pricing[i - 1].closeTime : '';
                        const openMin = i === 0 ? row.openTime : (prevClose ? addMinute(prevClose) : row.openTime);
                        const closeMin = p.openTime || openMin;
                        const issue = pricingIssue(row, i);
                        return (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <input type="time" aria-label={`${label} pricing ${i + 1} open time`} value={p.openTime} min={openMin || undefined} max={row.closeTime || undefined} onChange={(e) => updatePricing(dow, i, { openTime: clampTime(e.target.value, openMin, row.closeTime) })} className={tInput(issue.openBad)} />
                          <span className="text-[var(--muted)]">to</span>
                          <input type="time" aria-label={`${label} pricing ${i + 1} close time`} value={p.closeTime} min={closeMin || undefined} max={row.closeTime || undefined} onChange={(e) => updatePricing(dow, i, { closeTime: clampTime(e.target.value, closeMin, row.closeTime) })} className={tInput(issue.closeBad)} />
                          <div className="flex items-center gap-1 h-11 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 focus-within:border-[var(--primary)]">
                            <span className="text-[var(--muted)] text-[15px]">₱</span>
                            <input inputMode="decimal" aria-label={`${label} pricing ${i + 1} rate`} value={p.price} maxLength={7} onChange={(e) => updatePricing(dow, i, { price: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Rate" className="w-16 bg-transparent text-[16px] text-[var(--ink)] outline-none" />
                          </div>
                          {i === 0 ? (
                            <button type="button" onClick={() => addPricing(dow)} className="h-11 px-3 rounded-xl bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] inline-flex items-center gap-1 shrink-0">
                              <Icon name="plus" size={14} /> Add hour pricing
                            </button>
                          ) : (
                            <button type="button" onClick={() => removePricing(dow, i)} aria-label={`Remove ${label} pricing ${i + 1}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] shrink-0">
                              <Icon name="close" size={16} />
                            </button>
                          )}
                          {issue.message && <div className="basis-full t-sm text-[var(--coral)] font-bold">{issue.message}</div>}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-3">Couldn't save hours. Try again.</div>}
        {hasInvalidPricing && <div className="t-sm text-[var(--coral)] font-bold mt-3">Fix the highlighted hour-pricing times before saving.</div>}
        <Button fullWidth className="mt-4" onClick={onSaveHours} disabled={status === 'saving' || hasInvalidPricing}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Saved</> : 'Save hours'}
        </Button>
      </OwnerSection>

      <OwnerSection title="Holiday closures" icon="calendar" description="One-off dates your venue is closed.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="field p-0!">
            <label className="lbl">Date</label>
            <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className={timeInputClass} />
          </div>
          <div className="field p-0! flex-1 min-w-[180px]">
            <label className="lbl">Reason (optional)</label>
            <input className="control" value={cReason} maxLength={200} onChange={(e) => setCReason(e.target.value)} placeholder="e.g. Christmas Day" />
          </div>
          <button
            type="button"
            onClick={onAddClosure}
            disabled={!cDate || cStatus === 'saving'}
            className="h-12 px-5 rounded-2xl bg-[var(--primary)] text-white font-heading font-semibold text-[15px] disabled:opacity-60"
          >
            {cStatus === 'saving' ? 'Adding…' : 'Add'}
          </button>
        </div>
        {cStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-2">Couldn't add the closure. Try again.</div>}

        <ul className="mt-4 space-y-2">
          {sortedClosures.length === 0 ? (
            <li className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No closures scheduled.</li>
          ) : (
            sortedClosures.map((c) => {
              const id = entityId(c);
              return (
                <li key={id} className="flex items-center justify-between rounded-xl border-[0.5px] border-[var(--hairline)] px-4 py-3">
                  <div>
                    <div className="font-bold text-[14px] text-[var(--ink)]">{c.closureDate}</div>
                    {c.reason && <div className="t-sm">{c.reason}</div>}
                  </div>
                  <button type="button" onClick={() => onDeleteClosure(id)} aria-label={`Remove closure on ${c.closureDate}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)]">
                    <Icon name="close" size={18} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </OwnerSection>

      <Toast message="Hours saved" show={status === 'saved'} />
    </div>
  );
}
