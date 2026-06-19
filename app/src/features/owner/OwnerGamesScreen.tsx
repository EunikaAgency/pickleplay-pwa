import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Segmented } from '../../shared/components/ui/Segmented';
import { Chip } from '../../shared/components/ui/Chip';
import { Toast } from '../../shared/components/ui/Toast';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { OwnerStat } from './components/OwnerStat';
import { OwnerGameCard } from './components/OwnerGameCard';
import { OwnerBookingRow } from './components/OwnerBookingRow';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { todayYMD } from '../bookings/bookingDisplay';
import type { ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerGamesScreenProps {
  onNavigate: Navigate;
}

type Mode = 'schedule' | 'games';
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const CALENDAR = (() => {
  const today = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    return { wd: i === 0 ? 'TODAY' : i === 1 ? 'TOM' : WD[d.getDay()], dn: d.getDate(), iso: ymd(d), key: i };
  });
})();

// Owner's Games tab — "Your courts": a Schedule (bookings + games agenda per
// day) and a Games list (community games at the owner's venues). Replaces the
// player GamesScreen for owners (gated by owner.games.view in App.tsx).
export function OwnerGamesScreen({ onNavigate }: OwnerGamesScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry, bookings, games, updateBookingRow } = useOwnerDashboard({ withGames: true, withBookings: true, withAnalytics: false });
  const [mode, setMode] = useState<Mode>('schedule');
  const [dayIdx, setDayIdx] = useState(0);
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [detail, setDetail] = useState<ApiBooking | null>(null);
  const [toast, setToast] = useState(false);

  // Reflect a status change from the row/detail-sheet into the loaded list.
  const onBookingChanged = useCallback((updated: ApiBooking) => {
    updateBookingRow(updated);
    setToast(true);
    setTimeout(() => setToast(false), 1800);
  }, [updateBookingRow]);

  const matchesVenue = useCallback((vid?: string | null) => venueFilter === 'all' || (vid || '') === venueFilter, [venueFilter]);
  const today = todayYMD();
  const weekEnd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return ymd(d); }, []);

  const selISO = CALENDAR[dayIdx].iso;
  const dayBookings = useMemo(
    () => (canBookings ? bookings.filter((b) => b.date === selISO && b.status !== 'cancelled' && matchesVenue(b.venueId)).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')) : []),
    [bookings, selISO, canBookings, matchesVenue],
  );
  const dayGames = useMemo(
    () => games.filter((g) => g.date === selISO && matchesVenue(g.venueId)),
    [games, selISO, matchesVenue],
  );

  const upcomingGames = useMemo(
    () => games.filter((g) => (g.date || '') >= today && matchesVenue(g.venueId)),
    [games, today, matchesVenue],
  );
  const gameGroups = useMemo(() => [
    { label: 'Today', items: upcomingGames.filter((g) => g.date === today) },
    { label: 'This week', items: upcomingGames.filter((g) => (g.date || '') > today && (g.date || '') <= weekEnd) },
    { label: 'Later', items: upcomingGames.filter((g) => (g.date || '') > weekEnd) },
  ].filter((g) => g.items.length > 0), [upcomingGames, today, weekEnd]);

  const header = (
    <div className="app-header">
      <div>
        <div className="greet-name">Your courts</div>
        <div className="greet-sub">Games &amp; bookings at your venues</div>
      </div>
    </div>
  );

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<ErrorState title="Couldn't load your courts" message="We couldn't reach your venues. Tap to retry." onRetry={retry} /></div>;
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: 'schedule', label: 'Schedule' }, { value: 'games', label: 'Games' }]}
        />

        {venues.length > 1 && (
          <div className="scroll-x flex gap-2">
            <Chip selected={venueFilter === 'all'} onClick={() => setVenueFilter('all')}>All venues</Chip>
            {venues.map((v) => (
              <Chip key={v.id} selected={venueFilter === v.id} onClick={() => setVenueFilter(v.id)}>{v.displayName}</Chip>
            ))}
          </div>
        )}

        {mode === 'schedule' ? (
          <>
            <div className="cal-strip">
              {CALENDAR.map((d, i) => (
                <button key={d.key} className={`day ${dayIdx === i ? 'active' : ''}`} onClick={() => setDayIdx(i)}>
                  <span className="wd">{d.wd}</span>
                  <span className="dn">{d.dn}</span>
                </button>
              ))}
            </div>

            {dayBookings.length === 0 && dayGames.length === 0 ? (
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">Nothing scheduled on this day.</div>
            ) : (
              <div className="space-y-4">
                {dayBookings.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="t-eyebrow flex items-center gap-1.5"><Icon name="calendar" size={13} /> Bookings</div>
                    {dayBookings.map((b) => (
                      <OwnerBookingRow key={b.id} booking={b} canManage={canBookings} showVenue onChanged={onBookingChanged} onOpen={setDetail} />
                    ))}
                  </section>
                )}
                {dayGames.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="t-eyebrow flex items-center gap-1.5"><Icon name="paddle" size={13} /> Games</div>
                    {dayGames.map((g) => <OwnerGameCard key={g.id} game={g} onOpen={() => onNavigate('game-details', { id: g.id })} />)}
                  </section>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <OwnerStat label="Upcoming games" value={upcomingGames.length} icon="paddle" tone="primary" />
              <OwnerStat label="Players coming" value={upcomingGames.reduce((t, g) => t + (g.participantCount ?? 0), 0)} icon="groups" tone="lime" />
            </div>
            {gameGroups.length === 0 ? (
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No games at your venues yet. When players organize a game on your courts, it shows up here.</div>
            ) : (
              gameGroups.map((grp) => (
                <section key={grp.label} className="space-y-2.5">
                  <div className="hd-3">{grp.label}</div>
                  {grp.items.map((g) => <OwnerGameCard key={g.id} game={g} onOpen={() => onNavigate('game-details', { id: g.id })} />)}
                </section>
              ))
            )}
          </>
        )}
      </div>

      <OwnerBookingDetailSheet
        booking={detail}
        canManage={canBookings}
        onClose={() => setDetail(null)}
        onChanged={onBookingChanged}
      />
      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
