import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import { Button } from '../../../shared/components/ui/Button';
import { Icon } from '../../../shared/components/ui/Icon';
import type { Navigate } from '../../../shared/lib/navigation';
import { listBookings, listGames, type ApiBooking } from '../../../shared/lib/api';
import { prettyDate, timeRange, todayYMD } from '../../bookings/bookingDisplay';

interface CreateChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  onNavigate: Navigate;
}

type Step = 'choice' | 'host';

/**
 * The "Game On" chooser. Tapping the create action no longer drops the user
 * straight into the form — it asks whether they want to **join** an existing game
 * (→ the Games browse/discover list) or **host a lobby** of their own. Hosting
 * requires a booked court, so step two lists the user's hostable bookings (or
 * sends them to Nearby to book one first). Picking a booking opens the create
 * form locked to that reservation. Only mounted for the v2.1 player design.
 */

// A booking can host a lobby if it's a real, upcoming reservation the user hasn't
// already opened a lobby on (one booking → one lobby).
function isHostable(b: ApiBooking, usedBookingIds: Set<string>, today: string): boolean {
  const status = (b.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'canceled') return false;
  if (b.date && b.date < today) return false; // already in the past
  return !usedBookingIds.has(b.id);
}

export function CreateChoiceSheet({ open, onClose, onNavigate }: CreateChoiceSheetProps) {
  const [step, setStep] = useState<Step>('choice');
  const [loading, setLoading] = useState(false);
  // null = not loaded yet (distinguishes "loading" from "loaded, empty").
  const [bookings, setBookings] = useState<ApiBooking[] | null>(null);

  // Close + reset to the first step, so the next open always starts at the choice
  // (state changes here are in an event handler, not an effect, by design).
  const close = () => { setStep('choice'); setBookings(null); setLoading(false); onClose(); };

  // "Host": switch to the picker and kick off the booking fetch (the fetch itself
  // runs in the effect below; loading is flipped here so the effect body stays
  // free of synchronous state writes).
  const goHost = () => { setStep('host'); setLoading(true); };

  // Load the user's hostable bookings once the picker is shown.
  useEffect(() => {
    if (!open || step !== 'host' || bookings !== null) return;
    let alive = true;
    const today = todayYMD();
    Promise.all([
      listBookings().catch(() => [] as ApiBooking[]),
      listGames({ mine: true }).catch(() => []),
    ])
      .then(([bk, games]) => {
        if (!alive) return;
        const used = new Set(games.map((g) => g.bookingId).filter((id): id is string => !!id));
        const list = bk
          .filter((b) => isHostable(b, used, today))
          .sort((a, b) => `${a.date ?? ''}${a.startTime ?? ''}`.localeCompare(`${b.date ?? ''}${b.startTime ?? ''}`));
        setBookings(list);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, step, bookings]);

  const goJoin = () => { close(); onNavigate('games'); };
  const goBookFirst = () => { close(); onNavigate('nearby', { intent: 'lobby' }); };
  const pickBooking = (b: ApiBooking) => { close(); onNavigate('create-game', { bookingId: b.id }); };

  const subtitle = step === 'choice'
    ? 'Jump into an open game, or host your own on a court you’ve booked.'
    : 'Pick the court you’ve booked to host your lobby on.';

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={step === 'choice' ? 'Game on!' : 'Host a lobby'}
      subtitle={subtitle}
    >
      <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        {step === 'choice' ? (
          <div className="flex flex-col gap-3 mt-1">
            <ChoiceCard
              icon="groups"
              tone="lime"
              title="Join a game"
              desc="Browse open games near you and grab a spot."
              onClick={goJoin}
            />
            <ChoiceCard
              icon="plus"
              tone="primary"
              title="Host a lobby"
              desc="Open a game on a court you’ve booked."
              onClick={goHost}
            />
          </div>
        ) : loading || bookings === null ? (
          <p className="text-[14px] text-[var(--muted)] font-semibold py-6 text-center">Finding your booked courts…</p>
        ) : bookings.length === 0 ? (
          <div className="py-2">
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mb-4 flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center shrink-0">
                <Icon name="calendar" size={18} />
              </span>
              <div>
                <div className="text-[14px] font-bold text-[var(--ink)]">Book a court first</div>
                <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5">
                  Hosting a lobby needs a reserved court. Book one and we’ll bring you right back to set up your game.
                </div>
              </div>
            </div>
            <Button fullWidth onClick={goBookFirst}>
              <Icon name="map_pin" size={16} /> Book a court
            </Button>
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full mt-2.5 py-2 text-[14px] font-bold text-[var(--primary)]"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="mt-1">
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {bookings.map((b) => {
                const court = b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : '');
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pickBooking(b)}
                    className="time-pick text-left px-3.5! py-3! flex items-center gap-3 bg-[var(--surface)]! text-[var(--ink)]!"
                  >
                    <span className="w-10 h-10 rounded-xl shrink-0 bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center">
                      <Icon name="paddle" size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-[14px] truncate">{b.venueName || 'Booked court'}</div>
                      <div className="text-[11px] opacity-70 font-semibold truncate">
                        {[prettyDate(b.date), timeRange(b), court].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Icon name="chevron" size={16} />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={goBookFirst}
              className="w-full mt-3 py-2.5 rounded-full border-[1.5px] border-[var(--hairline)] text-[14px] font-bold text-[var(--ink)] flex items-center justify-center gap-2"
            >
              <Icon name="plus" size={16} /> Book another court
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function ChoiceCard({ icon, tone, title, desc, onClick }: {
  icon: string;
  tone: 'lime' | 'primary';
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const ring = tone === 'lime' ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' : 'bg-[var(--primary-tint)] text-[var(--primary)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform"
    >
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${ring}`}>
        <Icon name={icon} size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-bold text-[16px] text-[var(--ink)]">{title}</div>
        <div className="text-[12.5px] font-semibold text-[var(--muted)] mt-0.5">{desc}</div>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  );
}
