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

interface Row {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

const timeInputClass =
  'h-11 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[16px] text-[var(--ink)] focus:border-[var(--primary)] outline-none';

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
      const byDow: Record<number, Row> = {};
      if (h.status === 'fulfilled') {
        for (const e of h.value) {
          byDow[e.dayOfWeek] = { isClosed: !!e.isClosed, openTime: hhmm(e.openTime), closeTime: hhmm(e.closeTime) };
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

  const get = (dow: number): Row => rows[dow] ?? { isClosed: false, openTime: '', closeTime: '' };
  const update = (dow: number, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [dow]: { ...get(dow), ...patch } }));
    setStatus('idle');
  };

  const onSaveHours = async () => {
    setStatus('saving');
    const entries: OwnerHourEntry[] = DAYS.map(({ dow }) => {
      const row = get(dow);
      return {
        dayOfWeek: dow,
        isClosed: row.isClosed,
        ...(row.isClosed ? {} : { openTime: row.openTime || undefined, closeTime: row.closeTime || undefined }),
      };
    });
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

  if (loading) {
    return <div className="card p-8 text-center t-sm">Loading hours…</div>;
  }

  return (
    <div className="space-y-4">
      <OwnerSection title="Weekly hours" icon="clock" description="Set open and close times for each day. Toggle Closed for rest days.">
        <div className="divide-y divide-[var(--hairline)]">
          {DAYS.map(({ dow, label }) => {
            const row = get(dow);
            return (
              <div key={dow} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 font-bold text-[14px] text-[var(--ink)]">{label}</span>
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  <input type="checkbox" checked={row.isClosed} onChange={(e) => update(dow, { isClosed: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                  Closed
                </label>
                {!row.isClosed && (
                  <div className="flex items-center gap-2">
                    <input type="time" aria-label={`${label} open time`} value={row.openTime} onChange={(e) => update(dow, { openTime: e.target.value })} className={timeInputClass} />
                    <span className="text-[var(--muted)]">to</span>
                    <input type="time" aria-label={`${label} close time`} value={row.closeTime} onChange={(e) => update(dow, { closeTime: e.target.value })} className={timeInputClass} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-3">Couldn't save hours. Try again.</div>}
        <Button fullWidth className="mt-4" onClick={onSaveHours} disabled={status === 'saving'}>
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
