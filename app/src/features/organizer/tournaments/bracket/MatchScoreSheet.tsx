import { useState } from 'react';
import { BottomSheet } from '../../../../shared/components/ui/BottomSheet';
import { Button } from '../../../../shared/components/ui/Button';
import type { ApiMatch, MatchFormat } from '../../../../shared/lib/api';

interface MatchScoreSheetProps {
  open: boolean;
  onClose: () => void;
  match: ApiMatch | null;
  matchFormat: MatchFormat;
  onSubmit: (matchId: string, body: { games: { a: number; b: number }[] } | { walkover: 'A' | 'B' }) => Promise<void>;
  onClear: (matchId: string) => Promise<void>;
}

const gamesForFormat = (f: MatchFormat) => (f === 'bo5' ? 5 : f === 'bo3' ? 3 : 1);

/** Enter a match result on mobile: per-game scores or a walkover. The bracket
 *  view opens this for any match with both entrants present. */
export function MatchScoreSheet({ open, onClose, match, matchFormat, onSubmit, onClear }: MatchScoreSheetProps) {
  const count = gamesForFormat(matchFormat);
  const [rows, setRows] = useState<{ a: string; b: string }[]>(() => Array.from({ length: count }, () => ({ a: '', b: '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameA = match?.entrantA?.displayName ?? 'TBD';
  const nameB = match?.entrantB?.displayName ?? 'TBD';

  const setCell = (i: number, side: 'a' | 'b', v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [side]: v } : row)));

  const save = async () => {
    if (!match) return;
    const games = rows
      .filter((r) => r.a !== '' && r.b !== '')
      .map((r) => ({ a: Number(r.a), b: Number(r.b) }));
    if (!games.length) { setError('Enter at least one game score.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(match.id, { games });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the result.');
    } finally {
      setBusy(false);
    }
  };

  const walkover = async (side: 'A' | 'B') => {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(match.id, { walkover: side });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the walkover.');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!match) return;
    setBusy(true);
    try { await onClear(match.id); onClose(); } finally { setBusy(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Enter result" subtitle={`${nameA} vs ${nameB}`}>
      <div className="flex flex-col gap-3 px-1">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="t-eyebrow truncate">{nameA}</div>
          <div className="t-eyebrow">Game</div>
          <div className="t-eyebrow truncate">{nameB}</div>
        </div>
        {rows.map((row, i) => (
          <div key={`game-${i}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="number" inputMode="numeric" value={row.a} onChange={(e) => setCell(i, 'a', e.target.value)}
              className="h-11 rounded-xl bg-[var(--surface-2)] text-center font-heading font-bold text-[16px] text-[var(--ink)]"
              aria-label={`${nameA} game ${i + 1}`}
            />
            <div className="text-[12px] font-bold text-[var(--muted)] w-6 text-center">{i + 1}</div>
            <input
              type="number" inputMode="numeric" value={row.b} onChange={(e) => setCell(i, 'b', e.target.value)}
              className="h-11 rounded-xl bg-[var(--surface-2)] text-center font-heading font-bold text-[16px] text-[var(--ink)]"
              aria-label={`${nameB} game ${i + 1}`}
            />
          </div>
        ))}

        {error && <div className="text-[13px] font-semibold text-[var(--coral)]">{error}</div>}

        <Button fullWidth onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save result'}</Button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => walkover('A')} className="h-10 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50">
            Walkover: {nameA}
          </button>
          <button type="button" disabled={busy} onClick={() => walkover('B')} className="h-10 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50">
            Walkover: {nameB}
          </button>
        </div>

        {(match?.games?.length || match?.winner || match?.walkover) && (
          <button type="button" disabled={busy} onClick={clear} className="text-[13px] font-bold text-[var(--coral)] py-1 disabled:opacity-50">
            Clear result
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
