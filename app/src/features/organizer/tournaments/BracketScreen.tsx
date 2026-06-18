import { useEffect, useState } from 'react';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import {
  getTournament, getEntrants, getBracket, deleteBracket,
  type ApiTournament, type ApiEntrant, type ApiBracketData, type BracketFormat, type MatchFormat,
} from '../../../shared/lib/api';
import { EntrantsManager } from './bracket/EntrantsManager';
import { BracketGenerator } from './bracket/BracketGenerator';
import { BracketView } from './bracket/BracketView';

interface BracketScreenProps {
  tournamentId: string;
  onBack: () => void;
}

/** Orchestrates the bracket workflow for a tournament: before a bracket exists,
 *  manage entrants + generate; once it exists, score matches + view standings. */
export function BracketScreen({ tournamentId, onBack }: BracketScreenProps) {
  const [t, setT] = useState<ApiTournament | null>(null);
  const [entrants, setEntrants] = useState<ApiEntrant[]>([]);
  const [bracket, setBracket] = useState<ApiBracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getTournament(tournamentId), getEntrants(tournamentId).catch(() => []), getBracket(tournamentId).catch(() => null)])
      .then(([tour, ents, brk]) => {
        if (!alive) return;
        setT(tour);
        setEntrants(ents);
        setBracket(brk);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load the bracket.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId, reloadKey]);

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteBracket(tournamentId); } finally { setDeleting(false); reload(); }
  };

  const matchFormat = (t?.matchFormat as MatchFormat) || 'bo3';
  const hasBracket = !!bracket && Array.isArray(bracket.matches) && bracket.matches.length > 0;

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Bracket" eyebrow={t?.name || 'Tournament'} />

      <div className="px-5 flex flex-col gap-4">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : hasBracket && bracket ? (
          <>
            <BracketView tid={tournamentId} data={bracket} matchFormat={matchFormat} onChanged={reload} />
            <button type="button" onClick={handleDelete} disabled={deleting} className="text-[13px] font-bold text-[var(--coral)] py-2 disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete bracket & reseed'}
            </button>
          </>
        ) : (
          <>
            <EntrantsManager tid={tournamentId} entrants={entrants} onChanged={reload} />
            <BracketGenerator
              tid={tournamentId}
              entrantCount={entrants.length}
              defaultFormat={t?.format as BracketFormat | undefined}
              defaultMatchFormat={t?.matchFormat as MatchFormat | undefined}
              onGenerated={reload}
            />
          </>
        )}
      </div>
    </div>
  );
}
