import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import {
  getMyOpenPlay, createOpenPlaySeries, cancelOpenPlaySeries, cancelOpenPlaySession,
  type ApiOpenPlaySeries, type ApiOpenPlaySession,
} from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { OrganizerSection } from '../components/OrganizerSection';
import { useVenueOptions } from '../hooks/useVenueOptions';
import { DAYS_OF_WEEK, formatDays, money, prettyDate, timeRange } from '../organizerDisplay';

interface OpenPlayScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const emptyForm = {
  title: '', venueId: '', startTime: '18:00', endTime: '20:00',
  capacity: '12', price: '0', weeksAhead: '4', levelLabel: '', description: '',
};

export function OpenPlayScreen({ onNavigate, onBack }: OpenPlayScreenProps) {
  const [series, setSeries] = useState<ApiOpenPlaySeries[]>([]);
  const [sessions, setSessions] = useState<ApiOpenPlaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { options: venueOptions } = useVenueOptions();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMyOpenPlay()
      .then((d) => { if (alive) { setSeries(d.series); setSessions(d.sessions); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your open play.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const set = (k: keyof typeof emptyForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));

  const submit = async () => {
    if (!form.title.trim()) { setFormError('Give the series a title.'); return; }
    if (!form.venueId) { setFormError('Pick a venue.'); return; }
    if (!days.length) { setFormError('Choose at least one day of the week.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await createOpenPlaySeries({
        title: form.title.trim(),
        venueId: form.venueId,
        daysOfWeek: days,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity: Number(form.capacity) || 0,
        price: Number(form.price) || 0,
        weeksAhead: Number(form.weeksAhead) || 1,
        levelLabel: form.levelLabel.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setForm(emptyForm);
      setDays([]);
      setCreating(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create the series.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSeries = async (id: string) => {
    try { await cancelOpenPlaySeries(id); } finally { setReloadKey((k) => k + 1); }
  };
  const handleCancelSession = async (id: string) => {
    try { await cancelOpenPlaySession(id); } finally { setReloadKey((k) => k + 1); }
  };

  const sessionsForSeries = (seriesId: string) =>
    sessions.filter((s) => s.seriesId === seriesId && s.status !== 'cancelled')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Open Play"
        eyebrow="Recurring sessions"
        action={
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            aria-label="New series"
            className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center"
          >
            <Icon name={creating ? 'close' : 'plus'} size={18} />
          </button>
        }
      />

      <div className="px-5 flex flex-col gap-4">
        {creating && (
          <OrganizerSection title="New recurring series" icon="calendar" description="The app generates a session for each chosen day, every week ahead.">
            <div className="flex flex-col gap-3">
              <FormField label="Title" value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="Tuesday Night Social" required />
              <FormSelect
                label="Venue"
                value={form.venueId}
                onChange={(e) => set('venueId')(e.target.value)}
                options={[{ value: '', label: 'Select a venue…' }, ...venueOptions]}
                required
              />
              <div>
                <div className="t-eyebrow mb-1.5">Days of week</div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => toggleDay(d.n)}
                      aria-pressed={days.includes(d.n)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-bold ${
                        days.includes(d.n) ? 'bg-[var(--ink)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink-2)]'
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start time" type="time" value={form.startTime} onChange={(e) => set('startTime')(e.target.value)} />
                <FormField label="End time" type="time" value={form.endTime} onChange={(e) => set('endTime')(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Capacity" type="number" inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity')(e.target.value)} />
                <FormField label="Price" type="number" inputMode="numeric" value={form.price} onChange={(e) => set('price')(e.target.value)} />
                <FormField label="Weeks" type="number" inputMode="numeric" value={form.weeksAhead} onChange={(e) => set('weeksAhead')(e.target.value)} />
              </div>
              <FormField label="Level (optional)" value={form.levelLabel} onChange={(e) => set('levelLabel')(e.target.value)} placeholder="All levels" />
              {formError && <div className="text-[13px] font-semibold text-[var(--coral)]">{formError}</div>}
              <Button fullWidth onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create series'}</Button>
            </div>
          </OrganizerSection>
        )}

        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : series.length === 0 && !creating ? (
          <EmptyState
            icon="calendar"
            title="No open play yet"
            description="Create a recurring series and your weekly sessions will show up here."
            action={{ label: 'New series', onPress: () => setCreating(true) }}
          />
        ) : (
          series.map((s) => {
            const upcoming = sessionsForSeries(s.id);
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[16px] text-[var(--ink)] truncate">{s.title}</div>
                    <div className="t-sm">{s.venueName || 'Venue'} · {formatDays(s.daysOfWeek)}</div>
                    <div className="t-eyebrow mt-1">
                      {timeRange(s.startTime, s.endTime)} · {s.capacity} spots · {money(s.price)}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleCancelSeries(s.id)} className="text-[12px] font-bold text-[var(--coral)] shrink-0">
                    Cancel
                  </button>
                </div>

                {upcoming.length > 0 && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)] flex flex-col gap-2">
                    {upcoming.map((sess) => (
                      <div key={sess.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigate('organizer-session', { id: sess.id })}
                          className="flex-1 min-w-0 text-left flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-[var(--ink)] truncate">{prettyDate(sess.date)}</span>
                            <span className="block text-[12px] text-[var(--muted)]">{timeRange(sess.startTime, sess.endTime)}</span>
                          </span>
                          <span className="text-[12px] font-bold text-[var(--muted)] shrink-0">
                            {sess.joinedCount ?? 0}/{sess.capacity ?? 0}
                          </span>
                        </button>
                        <button type="button" onClick={() => handleCancelSession(sess.id)} aria-label="Cancel session" className="w-8 h-8 rounded-full bg-[var(--surface-3)] text-[var(--coral)] flex items-center justify-center shrink-0">
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
