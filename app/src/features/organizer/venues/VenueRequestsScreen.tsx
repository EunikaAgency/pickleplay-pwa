import { useEffect, useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import {
  getMyVenueRequests, submitVenueRequest, cancelVenueRequest,
  type ApiTournamentApplication,
} from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { OrganizerSection } from '../components/OrganizerSection';
import { StatusChip } from '../components/StatusChip';
import { useVenueOptions } from '../hooks/useVenueOptions';
import { prettyDate, regStatusChip, timeRange, todayYMD } from '../organizerDisplay';

interface VenueRequestsScreenProps {
  /** When present, the screen opens the "request a venue" form for this tournament. */
  tournamentId?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const emptyForm = {
  venueId: '', requestedStartDate: '', requestedEndDate: '',
  timeSlotStart: '08:00', timeSlotEnd: '18:00', courtsRequired: '2', message: '',
};

export function VenueRequestsScreen({ tournamentId, onBack }: VenueRequestsScreenProps) {
  const [requests, setRequests] = useState<ApiTournamentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { options: venueOptions } = useVenueOptions();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMyVenueRequests()
      .then((r) => { if (alive) setRequests(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your venue requests.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const set = (k: keyof typeof emptyForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!tournamentId) return;
    if (!form.venueId) { setFormError('Pick a venue.'); return; }
    if (!form.requestedStartDate || !form.requestedEndDate) { setFormError('Set the requested dates.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await submitVenueRequest({
        tournamentId,
        venueId: form.venueId,
        requestedStartDate: form.requestedStartDate,
        requestedEndDate: form.requestedEndDate,
        timeSlotStart: form.timeSlotStart,
        timeSlotEnd: form.timeSlotEnd,
        courtsRequired: Number(form.courtsRequired) || 1,
        message: form.message.trim() || undefined,
      });
      setForm(emptyForm);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not submit the request.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    try { await cancelVenueRequest(id); } catch { /* best-effort */ } finally { setReloadKey((k) => k + 1); }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Venue Requests" eyebrow="Tournament venues" />

      <div className="px-5 flex flex-col gap-4">
        {tournamentId && (
          <OrganizerSection title="Request a venue" icon="storefront" description="Sent to the venue owner to approve.">
            <div className="flex flex-col gap-3">
              <FormSelect label="Venue" value={form.venueId} onChange={(e) => set('venueId')(e.target.value)} options={[{ value: '', label: 'Select a venue…' }, ...venueOptions]} required />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start date" type="date" min={todayYMD()} value={form.requestedStartDate} onChange={(e) => set('requestedStartDate')(e.target.value)} required />
                <FormField label="End date" type="date" min={form.requestedStartDate || todayYMD()} value={form.requestedEndDate} onChange={(e) => set('requestedEndDate')(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="From" type="time" value={form.timeSlotStart} onChange={(e) => set('timeSlotStart')(e.target.value)} />
                <FormField label="To" type="time" value={form.timeSlotEnd} onChange={(e) => set('timeSlotEnd')(e.target.value)} />
                <FormField label="Courts" type="number" inputMode="numeric" value={form.courtsRequired} onChange={(e) => set('courtsRequired')(e.target.value)} />
              </div>
              <FormField label="Message (optional)" value={form.message} onChange={(e) => set('message')(e.target.value)} placeholder="Hoping to host our summer open here." />
              {formError && <div className="text-[13px] font-semibold text-[var(--coral)]">{formError}</div>}
              <Button fullWidth onClick={submit} disabled={saving}>{saving ? 'Sending…' : 'Send request'}</Button>
            </div>
          </OrganizerSection>
        )}

        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : requests.length === 0 ? (
          <EmptyState icon="storefront" title="No venue requests" description="Request a venue from a tournament's detail page and track approvals here." />
        ) : (
          requests.map((r) => {
            const dates = [prettyDate(r.requestedStartDate), r.requestedEndDate && r.requestedEndDate !== r.requestedStartDate ? prettyDate(r.requestedEndDate) : null].filter(Boolean).join(' – ');
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[15px] text-[var(--ink)] truncate">{r.venue?.name || 'Venue'}</div>
                    <div className="t-sm mt-0.5">{r.tournament?.name || 'Tournament'}</div>
                    <div className="t-eyebrow mt-1">{dates}{r.courtsRequired ? ` · ${r.courtsRequired} courts` : ''} · {timeRange(r.timeSlotStart, r.timeSlotEnd)}</div>
                  </div>
                  <StatusChip chip={regStatusChip(r.status)} />
                </div>
                {r.remarks && <div className="mt-2 text-[12px] text-[var(--muted)]">"{r.remarks}"</div>}
                {r.status === 'pending' && (
                  <button type="button" onClick={() => handleCancel(r.id)} className="mt-3 text-[12px] font-bold text-[var(--coral)]">
                    Withdraw request
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
