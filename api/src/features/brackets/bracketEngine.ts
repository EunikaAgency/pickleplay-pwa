// Pure tournament-bracket engine — no Mongoose, no Hono, no I/O.
//
// Generates bracket structures (single/double elimination, round robin, pool
// play) and resolves match results into advancements + standings. Everything
// here operates on plain objects keyed by a stable in-memory `key`; the
// controller maps those keys onto real Mongo ObjectIds when it persists.
//
// Keeping this layer pure is the whole point: the gnarly seeding / loser-drop
// math is exercised by bracketEngine.test.ts without a database in sight.

export type MatchFormat = 'bo1' | 'bo3' | 'bo5';
export type BracketFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'pool_play';
export type BracketSection = 'winners' | 'losers' | 'grand_final' | 'main' | 'playoff';
export type Slot = 'A' | 'B';
export type MatchStatus = 'pending' | 'ready' | 'completed' | 'bye';

export interface EngineEntrant {
  id: string;
  seed: number; // 1-based; the engine re-ranks defensively so gaps are fine
}

export interface EngineGame {
  a: number;
  b: number;
}

/** Where a playoff slot is filled from once pool standings are known. */
export interface SeedSource {
  poolKey: string;
  rank: number; // 1-based finishing position within the pool
}

export interface EngineMatch {
  key: string;
  bracket: BracketSection;
  round: number;
  slotInRound: number;
  poolKey: string | null;
  entrantA: string | null;
  entrantB: string | null;
  isByeA: boolean;
  isByeB: boolean;
  nextMatchKey: string | null;
  nextSlot: Slot | null;
  nextLoserMatchKey: string | null;
  nextLoserSlot: Slot | null;
  isGrandFinalReset: boolean;
  status: MatchStatus;
  winner: Slot | null;
  // Pool-play playoff slots that get seeded from standings later.
  seedSourceA?: SeedSource;
  seedSourceB?: SeedSource;
}

export interface PoolPlan {
  key: string;
  label: string;
  entrantIds: string[];
  advancers: number;
}

export interface GeneratedBracket {
  format: BracketFormat;
  bracketSize: number;
  matches: EngineMatch[];
  pools?: PoolPlan[];
  playoffSize?: number;
}

export interface GenerateOptions {
  poolCount?: number;
  advancersPerPool?: number;
}

export class BracketError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'BracketError';
  }
}

// ── small helpers ────────────────────────────────────────────────────────

function req<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new BracketError('ENGINE_BUG', message);
  return value;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function log2int(n: number): number {
  return Math.round(Math.log2(n));
}

/**
 * Standard single-elimination seed order for a power-of-two bracket: returns
 * the seed number that sits at each bracket position, so position 0 plays
 * position 1 in round 1 and the top seeds only meet in the final.
 * e.g. size 8 → [1,8,4,5,2,7,3,6].
 */
export function standardSeedOrder(size: number): number[] {
  let pots = [1, 2];
  while (pots.length < size) {
    const sum = pots.length * 2 + 1;
    const next: number[] = [];
    for (const p of pots) {
      next.push(p);
      next.push(sum - p);
    }
    pots = next;
  }
  return pots;
}

/** Sort entrants by seed and re-rank to a contiguous 1..n, preserving ids. */
function rankEntrants(entrants: EngineEntrant[]): EngineEntrant[] {
  return [...entrants]
    .sort((x, y) => x.seed - y.seed)
    .map((e, i) => ({ id: e.id, seed: i + 1 }));
}

function emptyMatch(
  key: string,
  bracket: BracketSection,
  round: number,
  slotInRound: number,
  poolKey: string | null = null,
): EngineMatch {
  return {
    key,
    bracket,
    round,
    slotInRound,
    poolKey,
    entrantA: null,
    entrantB: null,
    isByeA: false,
    isByeB: false,
    nextMatchKey: null,
    nextSlot: null,
    nextLoserMatchKey: null,
    nextLoserSlot: null,
    isGrandFinalReset: false,
    status: 'pending',
    winner: null,
  };
}

// ── single elimination ───────────────────────────────────────────────────

export function generateSingleElimination(entrants: EngineEntrant[]): GeneratedBracket {
  const ranked = rankEntrants(entrants);
  const n = ranked.length;
  if (n < 2) throw new BracketError('TOO_FEW_ENTRANTS', 'Need at least 2 entrants.');
  const size = nextPow2(n);
  const rounds = log2int(size);

  const byKey = new Map<string, EngineMatch>();
  const roundKeys: string[][] = [];

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = `M-R${r}-M${i}`;
      const m = emptyMatch(key, 'main', r, i);
      byKey.set(key, m);
      keys.push(key);
    }
    roundKeys.push(keys);
  }

  // Wire winners forward.
  for (let r = 1; r < rounds; r++) {
    const cur = req(roundKeys[r - 1], 'round');
    const nxt = req(roundKeys[r], 'round');
    cur.forEach((key, i) => {
      const m = req(byKey.get(key), 'match');
      m.nextMatchKey = req(nxt[Math.floor(i / 2)], 'next');
      m.nextSlot = i % 2 === 0 ? 'A' : 'B';
    });
  }

  // Place round-1 entrants by standard seeding (positions past n are byes).
  placeSeeds(byKey, req(roundKeys[0], 'r1'), ranked, size);

  resolveByes(byKey);
  computeStatuses(byKey);
  return { format: 'single_elimination', bracketSize: size, matches: [...byKey.values()] };
}

/** Fill a round's matches from a seed ordering; out-of-range seeds become byes. */
function placeSeeds(
  byKey: Map<string, EngineMatch>,
  r1Keys: string[],
  ranked: EngineEntrant[],
  size: number,
): void {
  const order = standardSeedOrder(size);
  const n = ranked.length;
  r1Keys.forEach((key, i) => {
    const m = req(byKey.get(key), 'match');
    const sa = req(order[2 * i], 'seedA');
    const sb = req(order[2 * i + 1], 'seedB');
    if (sa <= n) m.entrantA = req(ranked[sa - 1], 'eA').id;
    else m.isByeA = true;
    if (sb <= n) m.entrantB = req(ranked[sb - 1], 'eB').id;
    else m.isByeB = true;
  });
}

// ── double elimination ─────────────────────────────────────────────────────

export function generateDoubleElimination(entrants: EngineEntrant[]): GeneratedBracket {
  const ranked = rankEntrants(entrants);
  const n = ranked.length;
  if (n < 2) throw new BracketError('TOO_FEW_ENTRANTS', 'Need at least 2 entrants.');
  const size = nextPow2(n);
  const k = log2int(size);

  const byKey = new Map<string, EngineMatch>();
  const add = (m: EngineMatch) => {
    byKey.set(m.key, m);
    return m.key;
  };

  // Winners bracket (same shape as single elim).
  const wRounds: string[][] = [];
  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    const keys: string[] = [];
    for (let i = 0; i < count; i++) keys.push(add(emptyMatch(`W-R${r}-M${i}`, 'winners', r, i)));
    wRounds.push(keys);
  }
  for (let r = 1; r < k; r++) {
    const cur = req(wRounds[r - 1], 'wr');
    const nxt = req(wRounds[r], 'wr');
    cur.forEach((key, i) => {
      const m = req(byKey.get(key), 'm');
      m.nextMatchKey = req(nxt[Math.floor(i / 2)], 'n');
      m.nextSlot = i % 2 === 0 ? 'A' : 'B';
    });
  }
  placeSeeds(byKey, req(wRounds[0], 'wr1'), ranked, size);

  // Losers bracket. Rounds = 2*(k-1); counts are size/4, size/4, size/8, … 1, 1.
  const numL = 2 * (k - 1);
  const lRounds: string[][] = [];
  for (let lr = 1; lr <= numL; lr++) {
    const pairIndex = Math.ceil(lr / 2); // 1,1,2,2,3,3,…
    const count = size / 2 ** (pairIndex + 1);
    const keys: string[] = [];
    for (let i = 0; i < count; i++) keys.push(add(emptyMatch(`L-R${lr}-M${i}`, 'losers', lr, i)));
    lRounds.push(keys);
  }

  // Losers internal advancement (winner stays alive, moves to next L round).
  for (let lr = 1; lr < numL; lr++) {
    const cur = req(lRounds[lr - 1], 'lr');
    const nxt = req(lRounds[lr], 'lr');
    if (nxt.length === cur.length) {
      // "Major" round next: survivor keeps slot A, a winners-drop fills slot B.
      cur.forEach((key, i) => {
        const m = req(byKey.get(key), 'm');
        m.nextMatchKey = req(nxt[i], 'n');
        m.nextSlot = 'A';
      });
    } else {
      // "Minor" round next: survivors pair up.
      cur.forEach((key, i) => {
        const m = req(byKey.get(key), 'm');
        m.nextMatchKey = req(nxt[Math.floor(i / 2)], 'n');
        m.nextSlot = i % 2 === 0 ? 'A' : 'B';
      });
    }
  }

  // Winners-bracket losers drop into the losers bracket.
  // W-R1 losers seed L-R1 (both slots are drops).
  const wr1 = req(wRounds[0], 'wr1');
  const lr1 = req(lRounds[0], 'lr1');
  wr1.forEach((key, i) => {
    const m = req(byKey.get(key), 'm');
    m.nextLoserMatchKey = req(lr1[Math.floor(i / 2)], 'l');
    m.nextLoserSlot = i % 2 === 0 ? 'A' : 'B';
  });
  // W-R(j) losers (j>=2) drop into L-R(2j-2), slot B. Reverse the drop order on
  // alternating rounds — the standard anti-rematch crossover.
  for (let j = 2; j <= k; j++) {
    const targetRound = req(lRounds[2 * j - 3], 'lr'); // L-R(2j-2) is index 2j-3
    const wms = [...req(wRounds[j - 1], 'wr')];
    if (j % 2 === 0) wms.reverse();
    wms.forEach((wkey, i) => {
      const m = req(byKey.get(wkey), 'm');
      m.nextLoserMatchKey = req(targetRound[i], 'l');
      m.nextLoserSlot = 'B';
    });
  }

  // Grand final (+ reset). Slot A = winners champion, slot B = losers champion.
  const gf = add(emptyMatch('GF', 'grand_final', 1, 0));
  const reset = emptyMatch('GF2', 'grand_final', 2, 0);
  reset.isGrandFinalReset = true;
  const gf2 = add(reset);
  const wFinal = req(req(wRounds[k - 1], 'wf')[0], 'wf0');
  setNext(byKey, wFinal, gf, 'A');
  if (numL > 0) setNext(byKey, req(req(lRounds[numL - 1], 'lf')[0], 'lf0'), gf, 'B');
  else {
    // size 2 (k=1): the winners final's loser is the losers champion.
    const wf = req(byKey.get(wFinal), 'm');
    wf.nextLoserMatchKey = gf;
    wf.nextLoserSlot = 'B';
  }
  setNext(byKey, gf, gf2, 'A'); // GF→reset is special-cased on result entry

  resolveByes(byKey);
  computeStatuses(byKey);
  return { format: 'double_elimination', bracketSize: size, matches: [...byKey.values()] };
}

function setNext(byKey: Map<string, EngineMatch>, key: string, nextKey: string, slot: Slot): void {
  const m = req(byKey.get(key), 'm');
  m.nextMatchKey = nextKey;
  m.nextSlot = slot;
}

// ── round robin ────────────────────────────────────────────────────────────

export function generateRoundRobin(
  entrants: EngineEntrant[],
  poolKey: string | null = null,
): GeneratedBracket {
  const ranked = rankEntrants(entrants);
  const n = ranked.length;
  if (n < 2) throw new BracketError('TOO_FEW_ENTRANTS', 'Need at least 2 entrants.');

  // Circle method. Pad with a phantom (null) when odd so each round is even.
  const ids: (string | null)[] = ranked.map((e) => e.id);
  if (ids.length % 2 === 1) ids.push(null);
  const m = ids.length;
  const rounds = m - 1;
  const half = m / 2;

  const matches: EngineMatch[] = [];
  let arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    let slot = 0;
    for (let i = 0; i < half; i++) {
      const home = arr[i] ?? null;
      const away = arr[m - 1 - i] ?? null;
      if (home !== null && away !== null) {
        // Namespace keys by pool so multiple pools in pool-play don't collide.
        const prefix = poolKey ? `RR-${poolKey}` : 'RR';
        const match = emptyMatch(`${prefix}-R${r + 1}-M${slot}`, 'main', r + 1, slot, poolKey);
        match.entrantA = home;
        match.entrantB = away;
        match.status = 'ready';
        matches.push(match);
        slot++;
      }
    }
    // Rotate: keep arr[0] fixed, move the last element to position 1.
    const fixed = req(arr[0], 'fixed');
    const rest = arr.slice(1);
    const last = rest.pop();
    arr = [fixed, ...(last !== undefined ? [last] : []), ...rest];
  }

  return { format: 'round_robin', bracketSize: n, matches };
}

// ── pool play → single-elim playoff ────────────────────────────────────────

export function generatePoolPlay(
  entrants: EngineEntrant[],
  opts: GenerateOptions = {},
): GeneratedBracket {
  const ranked = rankEntrants(entrants);
  const n = ranked.length;
  const poolCount = Math.max(2, Math.floor(opts.poolCount ?? 2));
  const advancers = Math.max(1, Math.floor(opts.advancersPerPool ?? 2));
  if (n < poolCount * 2) {
    throw new BracketError('TOO_FEW_ENTRANTS', `Need at least ${poolCount * 2} entrants for ${poolCount} pools.`);
  }

  // Snake-distribute seeds across pools for balance.
  const pools: PoolPlan[] = [];
  for (let p = 0; p < poolCount; p++) {
    pools.push({ key: poolLabel(p), label: `Pool ${poolLabel(p)}`, entrantIds: [], advancers });
  }
  ranked.forEach((e, i) => {
    const row = Math.floor(i / poolCount);
    const col = i % poolCount;
    const p = row % 2 === 0 ? col : poolCount - 1 - col; // snake
    req(pools[p], 'pool').entrantIds.push(e.id);
  });

  // Round robin inside each pool.
  const matches: EngineMatch[] = [];
  for (const pool of pools) {
    const poolEntrants = pool.entrantIds.map((id, i) => ({ id, seed: i + 1 }));
    const rr = generateRoundRobin(poolEntrants, pool.key);
    matches.push(...rr.matches);
  }

  // Single-elim playoff with placeholder slots seeded from pool standings later.
  const playoffCount = poolCount * advancers;
  const playoffSize = nextPow2(playoffCount);
  const rounds = log2int(playoffSize);
  const seedPlan = playoffSeedPlan(poolCount, advancers); // index = playoff seed-1

  const byKey = new Map<string, EngineMatch>();
  const roundKeys: string[][] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = playoffSize / 2 ** r;
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = `P-R${r}-M${i}`;
      byKey.set(key, emptyMatch(key, 'playoff', r, i));
      keys.push(key);
    }
    roundKeys.push(keys);
  }
  for (let r = 1; r < rounds; r++) {
    const cur = req(roundKeys[r - 1], 'pr');
    const nxt = req(roundKeys[r], 'pr');
    cur.forEach((key, i) => {
      const m = req(byKey.get(key), 'm');
      m.nextMatchKey = req(nxt[Math.floor(i / 2)], 'n');
      m.nextSlot = i % 2 === 0 ? 'A' : 'B';
    });
  }
  // Attach seed sources to round-1 playoff slots (TBD until pools resolve).
  const order = standardSeedOrder(playoffSize);
  const r1 = req(roundKeys[0], 'pr1');
  r1.forEach((key, i) => {
    const m = req(byKey.get(key), 'm');
    const sa = req(order[2 * i], 'sa');
    const sb = req(order[2 * i + 1], 'sb');
    if (sa <= playoffCount) m.seedSourceA = req(seedPlan[sa - 1], 'sp');
    else m.isByeA = true;
    if (sb <= playoffCount) m.seedSourceB = req(seedPlan[sb - 1], 'sp');
    else m.isByeB = true;
  });

  matches.push(...byKey.values());
  return { format: 'pool_play', bracketSize: n, matches, pools, playoffSize };
}

function poolLabel(i: number): string {
  return String.fromCharCode(65 + i); // A, B, C, …
}

/**
 * Playoff seeding plan: rank-major then pool (all pool winners first, then all
 * runners-up, …) so top finishers spread across the bracket.
 */
function playoffSeedPlan(poolCount: number, advancers: number): SeedSource[] {
  const plan: SeedSource[] = [];
  for (let rank = 1; rank <= advancers; rank++) {
    for (let p = 0; p < poolCount; p++) plan.push({ poolKey: poolLabel(p), rank });
  }
  return plan;
}

// ── dispatcher ──────────────────────────────────────────────────────────────

export function generateBracket(
  format: BracketFormat,
  entrants: EngineEntrant[],
  opts: GenerateOptions = {},
): GeneratedBracket {
  switch (format) {
    case 'single_elimination':
      return generateSingleElimination(entrants);
    case 'double_elimination':
      return generateDoubleElimination(entrants);
    case 'round_robin':
      return generateRoundRobin(entrants);
    case 'pool_play':
      return generatePoolPlay(entrants, opts);
    default:
      throw new BracketError('BAD_FORMAT', `Unknown format ${format}`);
  }
}

// ── bye resolution + status ──────────────────────────────────────────────────

/**
 * Forward pass (matches were created in topological order) that auto-advances
 * byes: a match with one real entrant and one bye slot resolves immediately,
 * pushing the survivor downstream and marking the loser-drop (if any) a bye.
 */
export function resolveByesList(matches: EngineMatch[]): void {
  // The Map shares object references with the array, so the in-place mutations
  // are visible to the caller. Used to settle byes after the pool-play playoff
  // slots are seeded from standings.
  resolveByes(new Map(matches.map((m) => [m.key, m])));
}

function resolveByes(byKey: Map<string, EngineMatch>): void {
  for (const m of byKey.values()) {
    if (m.winner) continue;
    const aReal = m.entrantA !== null;
    const bReal = m.entrantB !== null;
    const aBye = m.isByeA;
    const bBye = m.isByeB;

    if (aReal && bReal) continue; // a genuine match — leave it
    if (!aReal && !bReal && !(aBye || bBye)) continue; // both feeders pending

    if (aReal && bBye) {
      m.winner = 'A';
      m.status = 'bye';
      advanceFromBye(byKey, m, m.entrantA);
    } else if (bReal && aBye) {
      m.winner = 'B';
      m.status = 'bye';
      advanceFromBye(byKey, m, m.entrantB);
    } else if (aBye && bBye) {
      // Empty match (only near-degenerate brackets) — propagate the void.
      m.status = 'bye';
      advanceFromBye(byKey, m, null);
    }
  }
}

function advanceFromBye(
  byKey: Map<string, EngineMatch>,
  m: EngineMatch,
  survivorId: string | null,
): void {
  if (m.nextMatchKey && m.nextSlot) placeInto(byKey, m.nextMatchKey, m.nextSlot, survivorId);
  // A bye has no real loser → the loser-drop slot becomes a bye too.
  if (m.nextLoserMatchKey && m.nextLoserSlot) placeInto(byKey, m.nextLoserMatchKey, m.nextLoserSlot, null);
}

function placeInto(
  byKey: Map<string, EngineMatch>,
  key: string,
  slot: Slot,
  entrantId: string | null,
): void {
  const t = req(byKey.get(key), 'target');
  if (slot === 'A') {
    if (entrantId !== null) t.entrantA = entrantId;
    else t.isByeA = true;
  } else if (entrantId !== null) t.entrantB = entrantId;
  else t.isByeB = true;
}

function computeStatuses(byKey: Map<string, EngineMatch>): void {
  for (const m of byKey.values()) {
    if (m.status === 'bye' || m.status === 'completed') continue;
    m.status = m.entrantA !== null && m.entrantB !== null ? 'ready' : 'pending';
  }
}

// ── result resolution ────────────────────────────────────────────────────────

export interface MatchResultInput {
  games?: EngineGame[];
  walkover?: Slot;
}

export interface MatchResultOutcome {
  winner: Slot;
  loser: Slot;
  gamesA: number;
  gamesB: number;
}

/**
 * Validate a submitted result against the match format and derive the winner.
 * Throws BracketError on malformed input; the controller turns that into a 400.
 */
export function applyMatchResult(
  input: MatchResultInput,
  settings: { matchFormat: MatchFormat; pointsPerGame: number },
): MatchResultOutcome {
  if (input.walkover) {
    const winner = input.walkover;
    return { winner, loser: winner === 'A' ? 'B' : 'A', gamesA: winner === 'A' ? 1 : 0, gamesB: winner === 'B' ? 1 : 0 };
  }

  const games = input.games ?? [];
  const needed = settings.matchFormat === 'bo1' ? 1 : settings.matchFormat === 'bo3' ? 2 : 3;
  const cap = settings.pointsPerGame;
  if (games.length === 0) throw new BracketError('NO_GAMES', 'Enter at least one game score.');

  let gamesA = 0;
  let gamesB = 0;
  games.forEach((g, i) => {
    if (!Number.isFinite(g.a) || !Number.isFinite(g.b) || g.a < 0 || g.b < 0) {
      throw new BracketError('BAD_SCORE', `Game ${i + 1} has an invalid score.`);
    }
    if (g.a === g.b) throw new BracketError('BAD_SCORE', `Game ${i + 1} cannot be a tie.`);
    const hi = Math.max(g.a, g.b);
    const lo = Math.min(g.a, g.b);
    if (hi < cap) throw new BracketError('BAD_SCORE', `Game ${i + 1} winner must reach ${cap}.`);
    if (hi - lo < 2) throw new BracketError('BAD_SCORE', `Game ${i + 1} must be won by 2.`);
    // Match should have ended once a side reached `needed` wins.
    if (gamesA >= needed || gamesB >= needed) {
      throw new BracketError('EXTRA_GAME', 'Too many games for this match format.');
    }
    if (g.a > g.b) gamesA++;
    else gamesB++;
  });

  if (gamesA < needed && gamesB < needed) {
    throw new BracketError('UNFINISHED', 'Not enough games to decide the match.');
  }
  const winner: Slot = gamesA > gamesB ? 'A' : 'B';
  return { winner, loser: winner === 'A' ? 'B' : 'A', gamesA, gamesB };
}

// ── advancement ──────────────────────────────────────────────────────────────

/**
 * Record a decided match and propagate its result through the bracket in place:
 * the winner advances to `nextMatch`, the loser drops to `nextLoserMatch` (double
 * elim), byes auto-resolve, and the grand-final reset activates only when the
 * losers-bracket entrant wins game one. Returns the champion id once the bracket
 * is decided (elimination/playoff only — round robin champions come from
 * standings). The controller uses this so the API and the tests share one
 * authoritative advancement implementation.
 */
export function applyResultToBracket(
  matches: EngineMatch[],
  matchKey: string,
  winner: Slot,
  format: BracketFormat,
): { championEntrantId: string | null } {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  let champion: string | null = null;

  const placeInto2 = (key: string, slot: Slot, id: string | null): void => {
    const t = byKey.get(key);
    if (!t || t.status === 'completed' || t.status === 'bye') return;
    if (slot === 'A') t.entrantA = id;
    else t.entrantB = id;
    const aReal = t.entrantA !== null;
    const bReal = t.entrantB !== null;
    if (aReal && t.isByeB) recordWin(t, 'A');
    else if (bReal && t.isByeA) recordWin(t, 'B');
    else if (aReal && bReal) t.status = 'ready';
  };

  function recordWin(m: EngineMatch, w: Slot): void {
    m.winner = w;
    m.status = 'completed';

    if (m.bracket === 'grand_final' && m.round === 1) {
      const reset = byKey.get('GF2');
      if (w === 'A') {
        champion = m.entrantA; // winners-bracket entrant stays undefeated
        if (reset) reset.status = 'bye';
      } else if (reset) {
        reset.entrantA = m.entrantA;
        reset.entrantB = m.entrantB;
        reset.status = 'ready';
      }
      return;
    }

    const winnerId = w === 'A' ? m.entrantA : m.entrantB;
    const loserId = w === 'A' ? m.entrantB : m.entrantA;
    if (m.nextMatchKey && m.nextSlot) placeInto2(m.nextMatchKey, m.nextSlot, winnerId);
    if (m.nextLoserMatchKey && m.nextLoserSlot) placeInto2(m.nextLoserMatchKey, m.nextLoserSlot, loserId);

    // Terminal-match champion detection (round robin is decided by standings).
    if (format === 'single_elimination' && m.bracket === 'main' && !m.nextMatchKey) champion = winnerId;
    else if (format === 'pool_play' && m.bracket === 'playoff' && !m.nextMatchKey) champion = winnerId;
    else if (format === 'double_elimination' && m.bracket === 'grand_final' && m.isGrandFinalReset) champion = winnerId;
  }

  const m = byKey.get(matchKey);
  if (!m) throw new BracketError('NO_MATCH', `No match ${matchKey}`);
  recordWin(m, winner);
  return { championEntrantId: champion };
}

// ── standings (round robin / pools) ──────────────────────────────────────────

export interface StandingRow {
  entrantId: string;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface CompletedMatch {
  entrantA: string | null;
  entrantB: string | null;
  winner: Slot | null;
  games: EngineGame[];
  poolKey?: string | null;
}

/**
 * Compute standings for a set of entrants over their completed matches.
 * Tie-break order: wins → head-to-head (2-way) → game diff → point diff → points-for.
 */
export function computeStandings(
  entrantIds: string[],
  matches: CompletedMatch[],
  poolKey?: string,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of entrantIds) {
    rows.set(id, {
      entrantId: id,
      rank: 0,
      played: 0,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  }

  const relevant = matches.filter(
    (m) =>
      m.winner !== null &&
      m.entrantA !== null &&
      m.entrantB !== null &&
      (poolKey === undefined || m.poolKey === poolKey) &&
      rows.has(m.entrantA) &&
      rows.has(m.entrantB),
  );

  for (const m of relevant) {
    if (m.entrantA === null || m.entrantB === null) continue;
    const a = req(rows.get(m.entrantA), 'rowA');
    const b = req(rows.get(m.entrantB), 'rowB');
    let ga = 0;
    let gb = 0;
    for (const g of m.games) {
      a.pointsFor += g.a;
      a.pointsAgainst += g.b;
      b.pointsFor += g.b;
      b.pointsAgainst += g.a;
      if (g.a > g.b) ga++;
      else gb++;
    }
    a.gamesWon += ga;
    a.gamesLost += gb;
    b.gamesWon += gb;
    b.gamesLost += ga;
    a.played++;
    b.played++;
    if (m.winner === 'A') {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
  }

  const headToHead = (x: StandingRow, y: StandingRow): number => {
    const m = relevant.find(
      (z) =>
        (z.entrantA === x.entrantId && z.entrantB === y.entrantId) ||
        (z.entrantA === y.entrantId && z.entrantB === x.entrantId),
    );
    if (!m) return 0;
    const xWon = (m.entrantA === x.entrantId && m.winner === 'A') || (m.entrantB === x.entrantId && m.winner === 'B');
    return xWon ? -1 : 1;
  };

  const ranked = [...rows.values()].sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const h2h = headToHead(x, y);
    if (h2h !== 0) return h2h;
    const xGd = x.gamesWon - x.gamesLost;
    const yGd = y.gamesWon - y.gamesLost;
    if (yGd !== xGd) return yGd - xGd;
    const xPd = x.pointsFor - x.pointsAgainst;
    const yPd = y.pointsFor - y.pointsAgainst;
    if (yPd !== xPd) return yPd - xPd;
    return y.pointsFor - x.pointsFor;
  });

  ranked.forEach((row, i) => {
    row.rank = i + 1;
    row.pointDiff = row.pointsFor - row.pointsAgainst;
  });
  return ranked;
}
