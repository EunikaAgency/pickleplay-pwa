import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { Toast } from '../../../shared/components/ui/Toast';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { OwnerSection } from '../components/OwnerSection';
import {
  listSlotOverrides, createSlotOverride, deleteSlotOverride, listCourts,
  type SlotPriceOverride, type ApiCourt,
} from '../../../shared/lib/api';
import { money, prettyDate, to12h } from '../../bookings/bookingDisplay';
import { PricingSuggestionsCard } from './PricingSuggestionsCard';

interface SlotPricingTabProps {
  venueId: string;
}

const todayYMD = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Manual surge / slot pricing: the owner raises or lowers the hourly rate for a
// specific date + time window (optionally one court). It overrides every other
// pricing rule for bookings whose start falls inside the window.
export function SlotPricingTab({ venueId }: SlotPricingTabProps) {
  const [courts, setCourts] = useState<ApiCourt[]>([]);
  const [overrides, setOverrides] = useState<SlotPriceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [date, setDate] = useState(todayYMD());
  const [courtId, setCourtId] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('21:00');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([listSlotOverrides(venueId), listCourts(venueId)])
      .then(([o, c]) => { setOverrides(o); setCourts(c); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [venueId]);

  const courtName = (id: string | null) => {
    if (!id) return 'All courts';
    const c = courts.find((x) => x.id === id);
    return c ? (c.courtName || `Court ${c.courtNumber}`) : 'Court';
  };

  const onAdd = async () => {
    setFormError(null);
    if (!date) { setFormError('Pick a date.'); return; }
    if (endTime <= startTime) { setFormError('End time must be after the start time.'); return; }
    if (price.trim() === '' || Number.isNaN(Number(price))) { setFormError('Enter a rate.'); return; }
    setStatus('saving');
    try {
      const created = await createSlotOverride(venueId, {
        courtId: courtId || undefined, date, startTime, endTime, price: Number(price), note: note.trim() || undefined,
      });
      setOverrides((xs) => [...xs, created].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
      setPrice(''); setNote('');
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setStatus('error');
      setFormError("Couldn't save that. Try again.");
    }
  };

  const onDelete = async (id: string) => {
    const prev = overrides;
    setOverrides((xs) => xs.filter((x) => x.id !== id));
    try {
      await deleteSlotOverride(id);
    } catch {
      setOverrides(prev); // restore on failure
    }
  };

  const upcoming = overrides.filter((o) => o.date >= todayYMD());
  const past = overrides.filter((o) => o.date < todayYMD());

  const courtOptions = [{ value: '', label: 'All courts' }, ...courts.map((c) => ({ value: c.id, label: c.courtName || `Court ${c.courtNumber}` }))];

  return (
    <div className="space-y-4">
      {/* Demand-based pricing suggestions (AI-generated from booking data). */}
      <PricingSuggestionsCard venueId={venueId} />

      <OwnerSection title="Set a slot rate" icon="bolt" description="Raise rates for peak demand (e.g. a tournament weekend) or run a promo by lowering them. Applies to bookings that start inside the window.">
        <div className="grid grid-cols-2 gap-3">
          <div className="field p-0!">
            <label className="lbl">Date</label>
            <input type="date" className="control" value={date} min={todayYMD()} onChange={(e) => { setDate(e.target.value); setStatus('idle'); }} />
          </div>
          <FormSelect label="Court" options={courtOptions} value={courtId} onChange={(e) => { setCourtId(e.target.value); setStatus('idle'); }} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="field p-0!">
            <label className="lbl">Start</label>
            <input type="time" step={3600} className="control" value={startTime} onChange={(e) => { setStartTime(e.target.value); setStatus('idle'); }} />
          </div>
          <div className="field p-0!">
            <label className="lbl">End</label>
            <input type="time" step={3600} className="control" value={endTime} onChange={(e) => { setEndTime(e.target.value); setStatus('idle'); }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <FormField label="Rate (₱/hr)" value={price} inputMode="decimal" placeholder="e.g. 400" onChange={(e) => { setPrice(e.target.value.replace(/[^\d.]/g, '')); setStatus('idle'); }} />
          <FormField label="Note (optional)" value={note} maxLength={200} placeholder="Holiday surge" onChange={(e) => { setNote(e.target.value); setStatus('idle'); }} />
        </div>
        {formError && <div className="t-sm text-[var(--coral)] font-bold mt-2">{formError}</div>}
        <Button fullWidth className="mt-3" onClick={onAdd} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Added</> : <><Icon name="plus" size={16} /> Add slot rate</>}
        </Button>
      </OwnerSection>

      <OwnerSection title="Active slot rates" icon="calendar" description="Upcoming overrides players will see at checkout.">
        {loading ? (
          <div className="t-sm py-2">Loading…</div>
        ) : error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load slot rates. <button type="button" className="underline font-bold" onClick={load}>Retry</button></div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No slot rates set. Add one above to surge or discount a specific time.</div>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)]">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-[var(--ink)]">{prettyDate(o.date)} · {to12h(o.startTime)}–{to12h(o.endTime)}</div>
                  <div className="t-sm truncate">{courtName(o.courtId)}{o.note ? ` · ${o.note}` : ''}</div>
                </div>
                <div className="font-heading font-bold text-[15px] text-[var(--ink)] tabular-nums shrink-0">{money(o.price)}/hr</div>
                <button type="button" onClick={() => onDelete(o.id)} aria-label="Remove slot rate" className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] shrink-0">
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {past.length > 0 && (
          <div className="t-sm text-[var(--muted)] mt-3">{past.length} past slot {past.length === 1 ? 'rate' : 'rates'} (no longer applied).</div>
        )}
      </OwnerSection>

      <Toast message="Slot rate added" show={status === 'saved'} />
    </div>
  );
}
