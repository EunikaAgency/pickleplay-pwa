import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { OwnerSection } from '../components/OwnerSection';
import {
  getClosures,
  createClosure,
  deleteClosure,
  entityId,
  type OwnerClosure,
} from '../../../shared/lib/api';

interface ClosuresEditorTabProps {
  venueId: string;
}

const dateInputClass =
  'h-11 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[16px] text-[var(--ink)] focus:border-[var(--primary)] outline-none';

// Venue-wide one-off closures (holidays, maintenance days). Operating hours now
// live per court (Courts tab); these closed dates stay venue-level since the whole
// venue shuts on them.
export function ClosuresEditorTab({ venueId }: ClosuresEditorTabProps) {
  const [closures, setClosures] = useState<OwnerClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const [cDate, setCDate] = useState('');
  const [cReason, setCReason] = useState('');
  const [cStatus, setCStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    getClosures(venueId)
      .then((c) => {
        if (cancelled) return;
        setClosures(c);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

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

  return (
    <div className="space-y-4">
      <OwnerSection title="Holiday closures" icon="calendar" description="One-off dates your whole venue is closed. Day-to-day open/close times are set per court on the Courts tab.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="field p-0!">
            <label className="lbl">Date</label>
            <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className={dateInputClass} />
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
          {loading ? (
            <li className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">Loading closures…</li>
          ) : sortedClosures.length === 0 ? (
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
    </div>
  );
}
