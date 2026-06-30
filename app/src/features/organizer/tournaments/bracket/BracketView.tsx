import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  submitMatchResult, clearMatchResult,
  type ApiBracketData, type ApiMatch, type ApiStanding, type MatchFormat,
} from '../../../../shared/lib/api';
import { Icon } from '../../../../shared/components/ui/Icon';
import { MatchScoreSheet } from './MatchScoreSheet';

const ROUND_NAMES = ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32'];
const SLOT_SPAN = 130;
const MATCH_W = 200;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface BracketViewProps {
  tid: string;
  data: ApiBracketData;
  matchFormat: MatchFormat;
  onChanged: () => void;
}

function formatLabel(f: string): string {
  const m: Record<string, string> = {
    single_elimination: 'Single elimination',
    double_elimination: 'Double elimination',
    round_robin: 'Round robin',
    pool_play: 'Pool play + knockout',
  };
  return m[f] || f;
}

function roundName(round: number, maxRound: number): string {
  const fromEnd = maxRound - round;
  return ROUND_NAMES[fromEnd] || `Round ${round}`;
}

function slotName(match: ApiMatch, slot: 'A' | 'B'): string {
  const e = slot === 'A' ? match.entrantA : match.entrantB;
  if (e?.displayName) return e.displayName;
  if (slot === 'A' && (match as any).isByeA) return 'Bye';
  if (slot === 'B' && (match as any).isByeB) return 'Bye';
  const src = slot === 'A' ? (match as any).seedSourceA : (match as any).seedSourceB;
  if (src) return `Pool ${src.poolKey} #${src.rank}`;
  return 'TBD';
}

/** Bracket view matching the web design: elimination tree with connector lines,
 *  proper match cards, format header, champion banner, and round-robin standings.
 *  Mobile-adapted with horizontal scroll instead of pan/zoom canvas. */
export function BracketView({ tid, data, matchFormat, onChanged }: BracketViewProps) {
  const [active, setActive] = useState<ApiMatch | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  const bracket = (data.bracket ?? {}) as Record<string, unknown>;
  const format = (bracket.format as string) ?? 'single_elimination';
  const entrantCount = (bracket.entrantCount as number) ?? data.entrants?.length ?? 0;
  const championId = bracket.championEntrantId as string | undefined;
  const pointsPerGame = bracket.pointsPerGame as number | undefined;
  const bMatchFormat = (bracket.matchFormat as string) ?? matchFormat;
  const entrantsById = useMemo(() => {
    const m: Record<string, { id: string; displayName: string }> = {};
    for (const e of data.entrants ?? []) m[e.id] = e;
    return m;
  }, [data.entrants]);
  const championName = championId ? entrantsById[championId]?.displayName : null;

  const onSubmit = async (matchId: string, body: { games: { a: number; b: number }[] } | { walkover: 'A' | 'B' }) => {
    await submitMatchResult(tid, matchId, body);
    onChanged();
  };
  const onClear = async (matchId: string) => {
    await clearMatchResult(tid, matchId);
    onChanged();
  };

  const hasTree = format !== 'round_robin';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] bg-[var(--ink)] text-white px-3 py-1.5 rounded-full">
            {formatLabel(format)}
          </span>
          <span className="text-[13px] font-semibold text-[var(--muted)]">
            {entrantCount} entrants{pointsPerGame ? ` · ${bMatchFormat?.toUpperCase()} to ${pointsPerGame}` : ''}
          </span>
        </div>
        {hasTree && (
          <button
            type="button"
            onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
            className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]"
          >
            <Icon name={orientation === 'horizontal' ? 'table_rows' : 'view_week'} size={14} />
            {orientation === 'horizontal' ? 'Vertical' : 'Horizontal'}
          </button>
        )}
      </div>

      {/* ── Champion banner ── */}
      {championName && (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--lime)]/15 border-[0.5px] border-[var(--lime)]/30 p-4">
          <Icon name="emoji_events" size={24} className="text-[var(--lime-ink)]" />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Champion</p>
            <p className="font-heading font-extrabold text-[16px] text-[var(--ink)]">{championName}</p>
          </div>
        </div>
      )}

      {/* ── Elimination tree ── */}
      {hasTree && data.matches?.length > 0 && (
        <EliminationTree
          matches={data.matches}
          onScore={setActive}
          orientation={orientation}
        />
      )}

      {/* ── Round-robin standings ── */}
      {format === 'round_robin' && data.standings?.length > 0 && (
        <StandingsView standings={data.standings} />
      )}

      {/* ── Pool play: per-pool standings + playoff tree ── */}
      {format === 'pool_play' && (
        <>
          {(data.standings ?? []).length > 0 && (
            <StandingsView standings={data.standings} />
          )}
          {data.matches?.filter(m => (m as any).bracket === 'playoff').length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="emoji_events" size={16} className="text-[var(--ink-2)]" />
                <span className="font-heading font-bold text-[14px] text-[var(--ink)]">Playoff</span>
              </div>
              <EliminationTree
                matches={data.matches.filter(m => (m as any).bracket === 'playoff')}
                onScore={setActive}
                orientation={orientation}
              />
            </div>
          )}
        </>
      )}

      {/* ── Match list for round robin / pools ── */}
      {(format === 'round_robin' || format === 'pool_play') && (
        <MatchList
          matches={data.matches?.filter(m => (m as any).bracket === 'main' || !(m as any).bracket) ?? []}
          onScore={setActive}
        />
      )}

      <MatchScoreSheet
        open={!!active}
        onClose={() => setActive(null)}
        match={active}
        matchFormat={matchFormat}
        onSubmit={onSubmit}
        onClear={onClear}
      />
    </div>
  );
}

/* ─── Pan/zoom canvas ──────────────────────────────────────────────────── */

function PanCanvas({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const vt = useRef({ tx: 0, ty: 0, scale: 1 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; id: number } | null>(null);
  const movedRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [panned, setPanned] = useState(false);

  const applyTransform = () => {
    const { tx, ty, scale: s } = vt.current;
    if (contentRef.current) contentRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  const syncState = () => {
    setScale(vt.current.scale);
    setPanned(vt.current.tx !== 0 || vt.current.ty !== 0 || vt.current.scale !== 1);
  };

  const zoomTo = (next: number, cx: number, cy: number) => {
    const prev = vt.current.scale;
    const s = clamp(+next.toFixed(3), ZOOM_MIN, ZOOM_MAX);
    if (s === prev) return;
    vt.current.tx = cx - ((cx - vt.current.tx) / prev) * s;
    vt.current.ty = cy - ((cy - vt.current.ty) / prev) * s;
    vt.current.scale = s;
    applyTransform();
    syncState();
  };
  const zoomStep = (dir: number) => {
    const el = viewportRef.current;
    if (!el) return;
    zoomTo(vt.current.scale + dir * ZOOM_STEP, el.clientWidth / 2, el.clientHeight / 2);
  };

  // Native event listeners for pointer + wheel — React synthetic events don't
  // play well with setPointerCapture (captured events bypass React's delegation).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const prev = vt.current.scale;
      const s = clamp(+(prev * (e.deltaY < 0 ? 1.12 : 1 / 1.12)).toFixed(3), ZOOM_MIN, ZOOM_MAX);
      if (s === prev) return;
      vt.current.tx = cx - ((cx - vt.current.tx) / prev) * s;
      vt.current.ty = cy - ((cy - vt.current.ty) / prev) * s;
      vt.current.scale = s;
      applyTransform();
      setScale(s);
      setPanned(vt.current.tx !== 0 || vt.current.ty !== 0 || s !== 1);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button > 0) return;
      const target = e.target as HTMLElement;
      if (target.closest?.('[data-no-pan]')) return;
      movedRef.current = false;
      dragRef.current = { x: e.clientX, y: e.clientY, tx: vt.current.tx, ty: vt.current.ty, id: e.pointerId };
      // Don't preventDefault here — we want the event to reach child buttons too
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!movedRef.current) {
        if (Math.hypot(dx, dy) <= 4) return;
        movedRef.current = true;
        vp.setPointerCapture(d.id);
      }
      vt.current.tx = d.tx + dx;
      vt.current.ty = d.ty + dy;
      applyTransform();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try { vp.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (movedRef.current) { syncState(); movedRef.current = false; }
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);

    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Fit the content into the viewport on mount
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    // Wait a frame so layout settles
    requestAnimationFrame(() => {
      const cw = ct.offsetWidth;
      const ch = ct.offsetHeight;
      if (!cw || !ch) return;
      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      const s = clamp(Math.min(vw / cw, vh / ch), ZOOM_MIN, 1);
      vt.current = { scale: s, tx: Math.max(0, (vw - cw * s) / 2), ty: Math.max(0, (vh - ch * s) / 2) };
      ct.style.transform = `translate(${vt.current.tx}px, ${vt.current.ty}px) scale(${s})`;
      setScale(s);
      setPanned(false);
    });
  }, []);

  useLayoutEffect(() => { fit(); }, [fit]);

  return (
    <div
      ref={viewportRef}
      className="relative select-none overflow-hidden rounded-xl"
      style={{
        height: '70vh',
        touchAction: 'none',
        backgroundColor: '#d9dee8',
        backgroundImage: 'radial-gradient(circle, rgba(30,41,59,0.16) 1px, transparent 1.6px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div ref={contentRef} className="absolute left-0 top-0 origin-top-left will-change-transform">
        {children}
      </div>

      {/* Zoom controls overlay */}
      <div data-no-pan className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-md backdrop-blur">
        <button type="button" onClick={() => zoomStep(-1)} disabled={scale <= ZOOM_MIN} aria-label="Zoom out" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink)] hover:bg-black/5 disabled:opacity-30">
          <Icon name="remove" size={16} />
        </button>
        <span className="w-9 text-center text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomStep(1)} disabled={scale >= ZOOM_MAX} aria-label="Zoom in" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink)] hover:bg-black/5 disabled:opacity-30">
          <Icon name="add" size={16} />
        </button>
        <span className="mx-0.5 h-4 w-px bg-[var(--hairline)]" />
        <button type="button" onClick={fit} disabled={!panned} aria-label="Fit to canvas" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink)] hover:bg-black/5 disabled:opacity-30">
          <Icon name="filter_center_focus" size={14} />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)] shadow-sm">
        <Icon name="open_with" size={11} /> Drag to pan · scroll to zoom
      </div>
    </div>
  );
}

/* ─── Elimination tree ─────────────────────────────────────────────────── */

function EliminationTree({
  matches,
  onScore,
  orientation,
}: {
  matches: ApiMatch[];
  onScore: (m: ApiMatch) => void;
  orientation: 'horizontal' | 'vertical';
}) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const cols = rounds.map((round) =>
    matches.filter((m) => m.round === round).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
  );
  const maxRound = Math.max(...rounds);
  const maxCount = Math.max(...cols.map((c) => c.length));
  const vertical = orientation === 'vertical';

  const stackStyle = vertical
    ? { minWidth: 80 + maxCount * 220 }
    : { minHeight: Math.max(400, maxCount * SLOT_SPAN) };

  return (
    <PanCanvas key={orientation}>
      <div className={`inline-flex items-stretch p-3 ${vertical ? 'flex-col-reverse' : ''}`} style={stackStyle}>
        {cols.map((col, ri) => (
          <Fragment key={rounds[ri]}>
            <RoundCol
              vertical={vertical}
              label={roundName(rounds[ri], maxRound)}
              matches={col}
              onScore={onScore}
            />
            {ri < cols.length - 1 && (
              <TreeConnector
                vertical={vertical}
                curCount={col.length}
                nextCount={cols[ri + 1].length}
              />
            )}
          </Fragment>
        ))}
      </div>
    </PanCanvas>
  );
}

function RoundCol({
  vertical,
  label,
  matches,
  onScore,
}: {
  vertical: boolean;
  label: string;
  matches: ApiMatch[];
  onScore: (m: ApiMatch) => void;
}) {
  const cards = matches.map((m) => (
    <div key={m.id} className={`flex flex-1 items-center ${vertical ? 'mx-1' : 'my-1'}`}>
      <div style={vertical ? { width: MATCH_W } : undefined}>
        <MatchCard match={m} onScore={onScore} />
      </div>
    </div>
  ));

  if (vertical) {
    return (
      <div className="flex flex-row">
        <div className="flex shrink-0 items-center justify-center" style={{ width: 80 }}>
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        </div>
        <div className="flex flex-1 flex-row">{cards}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col" style={{ minWidth: 200 }}>
      <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <div className="flex flex-1 flex-col">{cards}</div>
    </div>
  );
}

function TreeConnector({ vertical, curCount, nextCount }: { vertical: boolean; curCount: number; nextCount: number }) {
  const halving = nextCount > 0 && curCount === nextCount * 2;
  const straight = curCount === nextCount;
  const cells = halving || straight ? nextCount : 0;
  const line = 'absolute bg-[var(--hairline)]';

  const cell = (i: number) => (
    <div key={i} className={`relative flex-1 ${vertical ? '' : ''}`}>
      {halving ? (
        vertical ? (
          <>
            <span className={`${line} top-1/2 left-1/4 h-0.5 w-1/2`} />
            <span className={`${line} top-1/2 left-3/4 h-0.5 w-1/2`} />
            <span className={`${line} top-1/2 left-1/2 w-px h-1/2`} />
            <span className={`${line} top-0 left-1/2 w-px h-1/2`} />
          </>
        ) : (
          <>
            <span className={`${line} left-0 top-1/4 w-1/2 h-px`} />
            <span className={`${line} left-0 top-3/4 w-1/2 h-px`} />
            <span className={`${line} left-1/2 top-1/4 w-px h-1/2`} />
            <span className={`${line} left-1/2 top-1/2 w-1/2 h-px`} />
          </>
        )
      ) : vertical ? (
        <span className={`${line} top-0 left-1/2 w-px h-full`} />
      ) : (
        <span className={`${line} left-0 top-1/2 w-full h-px`} />
      )}
    </div>
  );

  if (vertical) {
    return (
      <div className="flex h-8 flex-row">
        <div className="shrink-0" style={{ width: 80 }} />
        <div className="flex flex-1 flex-row">{Array.from({ length: cells }).map((_, i) => cell(i))}</div>
      </div>
    );
  }
  return (
    <div className="flex w-6 shrink-0 flex-col">
      <p className="mb-2 text-center opacity-0" aria-hidden="true">.</p>
      <div className="flex flex-1 flex-col">{Array.from({ length: cells }).map((_, i) => cell(i))}</div>
    </div>
  );
}

/* ─── Match card ───────────────────────────────────────────────────────── */

function MatchCard({
  match,
  onScore,
}: {
  match: ApiMatch;
  onScore: (m: ApiMatch) => void;
}) {
  const ready = match.status === 'ready';
  const completed = match.status === 'completed';
  const winA = match.winner === 'A';
  const winB = match.winner === 'B';
  const playable = !!match.entrantA && !!match.entrantB && (ready || completed);

  return (
    <button
      type="button"
      onClick={() => onScore(match)}
      disabled={!playable && !completed}
      className={`w-full overflow-hidden rounded-lg border-2 bg-[var(--surface)] text-left shadow-sm transition-all ${
        ready
          ? 'cursor-pointer border-[var(--primary)] active:scale-[0.98]'
          : completed
            ? 'cursor-pointer border-[var(--hairline)] active:scale-[0.98]'
            : 'cursor-default border-dashed border-[var(--hairline)] opacity-50'
      }`}
    >
      <SlotRow
        name={slotName(match, 'A')}
        scores={match.games?.map((g) => g.a) ?? []}
        win={winA}
        dim={completed && !winA}
      />
      <div className="h-px bg-[var(--hairline)]" />
      <SlotRow
        name={slotName(match, 'B')}
        scores={match.games?.map((g) => g.b) ?? []}
        win={winB}
        dim={completed && !winB}
      />
      {ready && !completed && (
        <div className="border-t-2 border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1.5 text-center text-[11px] font-bold text-[var(--primary)]">
          Enter score
        </div>
      )}
      {completed && (
        <div className="flex items-center justify-center gap-1 border-t-[0.5px] border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
          <Icon name="edit" size={11} /> Edit
        </div>
      )}
    </button>
  );
}

function SlotRow({ name, scores, win, dim }: { name: string; scores: number[]; win?: boolean; dim?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${win ? 'bg-[var(--lime)]/10' : ''}`}>
      <span className={`truncate text-[13px] ${
        win ? 'font-heading font-bold text-[var(--ink)]' : dim ? 'text-[var(--muted)]' : 'font-semibold text-[var(--ink)]'
      }`}>
        {name}
      </span>
      {scores.length > 0 && (
        <span className="flex shrink-0 gap-1 font-mono text-[11px] text-[var(--muted)]">
          {scores.map((s, i) => <span key={`s-${i}`}>{s}</span>)}
        </span>
      )}
      {win && <span className="text-[10px] font-bold text-[var(--lime-ink)] bg-[var(--lime)] px-1.5 py-0.5 rounded-full shrink-0">W</span>}
    </div>
  );
}

/* ─── Standings ────────────────────────────────────────────────────────── */

function StandingsView({ standings }: { standings: ApiStanding[] }) {
  return (
    <div className="overflow-hidden rounded-xl border-[0.5px] border-[var(--hairline)]">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-[var(--surface-2)] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-2 py-2">Entrant</th>
            <th className="px-2 py-2 text-center w-10">W</th>
            <th className="px-2 py-2 text-center w-10">L</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.entrantId ?? i} className="border-t-[0.5px] border-[var(--hairline)]">
              <td className="px-3 py-2.5 font-heading font-bold text-[13px] text-[var(--muted)]">{s.rank ?? i + 1}</td>
              <td className="px-2 py-2.5 font-heading font-semibold text-[13px] text-[var(--ink)]">{s.displayName}</td>
              <td className="px-2 py-2.5 text-center text-[12px] font-bold text-[var(--ink)]">{s.wins ?? 0}</td>
              <td className="px-2 py-2.5 text-center text-[12px] font-bold text-[var(--muted)]">{s.losses ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Match list (round‑robin / pool play) ─────────────────────────────── */

function MatchList({
  matches,
  onScore,
}: {
  matches: ApiMatch[];
  onScore: (m: ApiMatch) => void;
}) {
  if (!matches.length) return null;
  const sorted = [...matches].sort((a, b) => a.round - b.round || (a.slot ?? 0) - (b.slot ?? 0));
  return (
    <div>
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">Matches</p>
      <div className="overflow-hidden rounded-xl border-[0.5px] border-[var(--hairline)] divide-y-[0.5px] divide-[var(--hairline)]">
        {sorted.map((m) => {
          const ready = m.status === 'ready';
          const scores = m.games ?? [];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onScore(m)}
              disabled={!ready}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${ready ? 'active:bg-[var(--surface-2)]' : ''}`}
            >
              <span className={`truncate text-[13px] ${m.winner === 'A' ? 'font-heading font-bold' : 'font-semibold'} text-[var(--ink)]`}>
                {slotName(m, 'A')}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-semibold text-[var(--muted)]">
                {m.status === 'completed' ? scores.map((g) => `${g.a}:${g.b}`).join(' ') : ready ? 'vs' : 'TBD'}
              </span>
              <span className={`truncate text-right text-[13px] ${m.winner === 'B' ? 'font-heading font-bold' : 'font-semibold'} text-[var(--ink)]`}>
                {slotName(m, 'B')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Re-export for backward compat
export { slotName };
