import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { listMyTournaments, type ApiTournament } from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { StatusChip } from '../components/StatusChip';
import { prettyDate, tournamentStatusChip } from '../organizerDisplay';

interface TournamentsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function TournamentsScreen({ onNavigate, onBack }: TournamentsScreenProps) {
  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listMyTournaments()
      .then((t) => { if (alive) setTournaments(t); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your tournaments.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Tournaments"
        eyebrow="Organizer"
        action={
          <button type="button" onClick={() => onNavigate('organizer-tournament-new')} aria-label="New tournament" className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
            <Icon name="plus" size={18} />
          </button>
        }
      />

      <div className="px-5 flex flex-col gap-3">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : tournaments.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="No tournaments yet"
            description="Create a draft, request a venue, open registration, then run the bracket."
            action={{ label: 'New tournament', onPress: () => onNavigate('organizer-tournament-new') }}
          />
        ) : (
          tournaments.map((t) => {
            const when = [prettyDate(t.startDate), t.endDate && t.endDate !== t.startDate ? prettyDate(t.endDate) : null].filter(Boolean).join(' – ');
            return (
              <button key={t.id} type="button" onClick={() => onNavigate('organizer-tournament', { id: t.id })} className="card p-4 w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[16px] text-[var(--ink)] truncate">{t.name}</div>
                    <div className="t-sm mt-0.5">{when || 'Dates TBD'}{t.venueName ? ` · ${t.venueName}` : ''}</div>
                  </div>
                  <StatusChip chip={tournamentStatusChip(t.status)} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
