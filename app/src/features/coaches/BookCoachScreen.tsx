import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { HourSelect } from '../../shared/components/ui/HourSelect';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import {
  ApiError, createCoachBooking, getCoach, type ApiCoachDetail,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { money, serviceDuration, serviceLabel } from './coachDisplay';

interface BookCoachScreenProps {
  coachId: string;
  serviceId?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Friendlier copy for the server's booking rejections. */
function bookingErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Could not send your request. Please try again.';
  switch (e.code) {
    case 'SLOT_TAKEN': return 'That time is already taken. Pick another slot.';
    case 'COACH_NOT_SUBSCRIBED': return 'This coach is not accepting bookings right now.';
    case 'SELF_BOOKING': return 'You cannot book yourself.';
    case 'SERVICE_INACTIVE': return 'That session type is no longer offered.';
    default: return e.message;
  }
}

export function BookCoachScreen({ coachId, serviceId, onNavigate, onBack }: BookCoachScreenProps) {
  const [coach, setCoach] = useState<ApiCoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const today = ymd(new Date());
  const [date, setDate] = useState(() => ymd(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  // HourSelect speaks "HH:00" strings; '' means nothing picked yet.
  const [startTime, setStartTime] = useState('');
  const [pickedService, setPickedService] = useState<string | undefined>(serviceId);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getCoach(coachId)
      .then((c) => { if (alive) setCoach(c); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coachId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true); setFailed(false); setReloadKey((k) => k + 1);
  }, []);

  const services = useMemo(() => (coach?.services ?? []).filter((s) => s.isActive !== false), [coach]);
  const selected = services.find((s) => s.id === pickedService) ?? null;

  // The server derives the real price; this is the same rule, shown up front so
  // the player isn't surprised.
  const price = selected
    ? selected.price
    : (coach?.pricePrivatePerHour ?? coach?.rateFrom ?? 0);

  const canSubmit = !!startTime && !submitting;

  const submit = async () => {
    if (!startTime || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCoachBooking({
        coachId: coach?.id ?? coachId,
        date,
        startTime,
        serviceId: pickedService,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(bookingErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="scroll">
        <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
          <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Request sent" />
        </div>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--lime)] text-[var(--lime-ink)]">
            <Icon name="check" size={30} />
          </div>
          <h2 className="font-heading text-[20px] font-extrabold">Request sent to {coach?.displayName}</h2>
          <p className="mt-2 max-w-[32ch] text-[14px] text-[var(--muted)]">
            They&apos;ll accept or decline it. You&apos;ll get a notification either way — nothing is charged yet.
          </p>
          <div className="mt-7 flex w-full max-w-[280px] flex-col gap-2">
            <Button fullWidth onClick={() => onNavigate('find-coach')}>Find another coach</Button>
            <Button variant="ghost" fullWidth onClick={() => onNavigate('home')}>Back to home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow={coach?.displayName ?? 'Coach'} title="Book a session" />
      </div>

      {loading && <div className="px-5 pt-6"><LoadingSkeleton variant="card" /></div>}
      {!loading && failed && (
        <ErrorState title="Couldn't load this coach" message="Please try again." onRetry={retry} />
      )}

      {!loading && !failed && coach && (
        <div className="px-5 pt-4">
          {/* Session type */}
          {services.length > 0 && (
            <section>
              <h2 className="font-heading text-[15px] font-extrabold">Session type</h2>
              <ul className="mt-3 flex flex-col gap-2">
                <li>
                  <button
                    type="button"
                    onClick={() => setPickedService(undefined)}
                    aria-pressed={!pickedService}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                      !pickedService ? 'border-[var(--primary)] bg-[var(--primary-soft,rgba(51,85,255,0.08))]' : 'border-[var(--hairline)] bg-[var(--surface)]'
                    }`}
                  >
                    <span className="flex-1 text-[14px] font-bold">Private session (1 hour)</span>
                    <span className="font-heading text-[14px] font-extrabold">
                      {money(coach.pricePrivatePerHour ?? coach.rateFrom ?? 0, coach.priceCurrency)}
                    </span>
                  </button>
                </li>
                {services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setPickedService(s.id)}
                      aria-pressed={pickedService === s.id}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                        pickedService === s.id ? 'border-[var(--primary)] bg-[var(--primary-soft,rgba(51,85,255,0.08))]' : 'border-[var(--hairline)] bg-[var(--surface)]'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{serviceLabel(s)}</span>
                        <span className="block text-[12px] text-[var(--muted)]">{serviceDuration(s)}</span>
                      </span>
                      <span className="flex-none font-heading text-[14px] font-extrabold">{money(s.price, coach.priceCurrency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <h2 className="font-heading text-[15px] font-extrabold">Date</h2>
            <div className="mt-3">
              <CalendarDatePicker value={date} onChange={setDate} min={today} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-heading text-[15px] font-extrabold">Start time</h2>
            <div className="mt-3">
              {/* Past hours are hidden when the chosen day is today. */}
              <HourSelect
                value={startTime}
                onChange={setStartTime}
                disabled={(hour) => date === today && hour <= new Date().getHours()}
              />
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              The coach confirms availability when they accept.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="font-heading text-[15px] font-extrabold">Notes <span className="font-normal text-[var(--muted)]">(optional)</span></h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What do you want to work on?"
              aria-label="Notes for the coach"
              className="mt-3 w-full rounded-xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3 text-[14px] outline-none placeholder:text-[var(--muted)]"
            />
          </section>

          <div className="mt-6 flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3.5">
            <span className="text-[13px] text-[var(--muted)]">Session price</span>
            <span className="font-heading text-[18px] font-extrabold">{money(price, coach.priceCurrency)}</span>
          </div>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            Nothing is charged now — you pay the coach once they accept.
          </p>

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]">
              {error}
            </div>
          )}
        </div>
      )}

      {!loading && !failed && coach && (
        <div className="sticky-cta">
          <Button fullWidth onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? 'Sending…' : !startTime ? 'Pick a start time' : 'Send request'}
          </Button>
        </div>
      )}
    </div>
  );
}
