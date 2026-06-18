import { useMemo, useState } from 'react';
import {
  submitMatchResult, clearMatchResult,
  type ApiBracketData, type ApiMatch, type MatchFormat,
} from '../../../../shared/lib/api';
import { OrganizerSection } from '../../components/OrganizerSection';
import { MatchScoreSheet } from './MatchScoreSheet';

interface BracketViewProps {
  tid: string;
  data: ApiBracketData;
  matchFormat: MatchFormat;
  onChanged: () => void;
}

function scoreLine(m: ApiMatch): string {
  if (m.walkover) return `Walkover (${m.walkover})`;
  if (m.games?.length) return m.games.map((g) => `${g.a}-${g.b}`).join(', ');
  return '';
}

/** Mobile-adapted bracket: a vertical, round-by-round list of tappable match
 *  cards (no pan/zoom canvas) plus a standings list. Tapping a match with both
 *  entrants opens the score sheet. */
export function BracketView({ tid, data, matchFormat, onChanged }: BracketViewProps) {
  const [active, setActive] = useState<ApiMatch | null>(null);

  const rounds = useMemo(() => {
    const byRound = new Map<number, ApiMatch[]>();
    for (const m of data.matches ?? []) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [data.matches]);

  const onSubmit = async (matchId: string, body: { games: { a: number; b: number }[] } | { walkover: 'A' | 'B' }) => {
    await submitMatchResult(tid, matchId, body);
    onChanged();
  };
  const onClear = async (matchId: string) => {
    await clearMatchResult(tid, matchId);
    onChanged();
  };

  return (
    <>
      {rounds.map(([round, matches]) => (
        <OrganizerSection key={round} title={`Round ${round}`} icon="layers">
          <div className="flex flex-col gap-2">
            {matches.map((m) => {
              const playable = !!(m.entrantA && m.entrantB);
              const line = scoreLine(m);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!playable}
                  onClick={() => setActive(m)}
                  className="w-full text-left rounded-xl bg-[var(--surface-2)] p-3 disabled:opacity-60"
                >
                  <Side name={m.entrantA?.displayName} win={m.winner === 'A'} />
                  <div className="h-px bg-[var(--hairline)] my-1.5" />
                  <Side name={m.entrantB?.displayName} win={m.winner === 'B'} />
                  {line && <div className="mt-2 text-[12px] font-semibold text-[var(--muted)]">{line}</div>}
                </button>
              );
            })}
          </div>
        </OrganizerSection>
      ))}

      {data.standings?.length > 0 && (
        <OrganizerSection title="Standings" icon="trophy">
          <div className="flex flex-col gap-1.5">
            {data.standings.map((s, i) => (
              <div key={s.entrantId ?? i} className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <span className="w-6 font-heading font-bold text-[14px] text-[var(--muted)]">{s.rank ?? i + 1}</span>
                <span className="flex-1 min-w-0 font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{s.displayName}</span>
                {(s.wins != null || s.losses != null) && (
                  <span className="text-[12px] font-bold text-[var(--muted)]">{s.wins ?? 0}–{s.losses ?? 0}</span>
                )}
              </div>
            ))}
          </div>
        </OrganizerSection>
      )}

      <MatchScoreSheet
        open={!!active}
        onClose={() => setActive(null)}
        match={active}
        matchFormat={matchFormat}
        onSubmit={onSubmit}
        onClear={onClear}
      />
    </>
  );
}

function Side({ name, win }: { name?: string; win?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`min-w-0 truncate text-[14px] ${win ? 'font-heading font-bold text-[var(--ink)]' : 'font-semibold text-[var(--ink-2)]'}`}>
        {name ?? 'TBD'}
      </span>
      {win && <span className="text-[11px] font-bold text-[var(--lime-ink)] bg-[var(--lime)] px-1.5 py-0.5 rounded-full shrink-0">W</span>}
    </div>
  );
}
