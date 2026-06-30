import { describe, it, expect } from 'vitest';
import {
  nextPow2,
  standardSeedOrder,
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generatePoolPlay,
  applyMatchResult,
  applyResultToBracket,
  computeStandings,
  BracketError,
  type BracketFormat,
  type EngineEntrant,
  type EngineMatch,
  type GeneratedBracket,
  type Slot,
  type CompletedMatch,
} from './bracketEngine.js';

function entrants(n: number): EngineEntrant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, seed: i + 1 }));
}

// ── a tiny simulator that mirrors the controller's advancement (incl. byes and
// the grand-final reset). Decides each match with `decide(match) => 'A'|'B'`.
interface Sim {
  list: EngineMatch[];
  map: Map<string, EngineMatch>;
  format: BracketFormat;
  winnersPairs: Set<string>;
  losersPairs: Set<string>;
  champion: string | null;
}

function pairKey(a: string | null, b: string | null): string {
  return [a, b].filter(Boolean).sort().join('|');
}

function buildSim(b: GeneratedBracket): Sim {
  const list = b.matches.map((m) => ({ ...m }));
  const map = new Map<string, EngineMatch>(list.map((m) => [m.key, m]));
  return { list, map, format: b.format, winnersPairs: new Set(), losersPairs: new Set(), champion: null };
}

// Drive the bracket via the real engine advancement (applyResultToBracket), so
// the tests exercise exactly what the controller calls.
function playOut(sim: Sim, decide: (m: EngineMatch) => Slot): void {
  for (let guard = 0; guard < 10000; guard++) {
    const ready = sim.list.find((m) => m.status === 'ready');
    if (!ready) return;
    const w = decide(ready);
    if (ready.bracket === 'winners') sim.winnersPairs.add(pairKey(ready.entrantA, ready.entrantB));
    if (ready.bracket === 'losers') sim.losersPairs.add(pairKey(ready.entrantA, ready.entrantB));
    const { championEntrantId } = applyResultToBracket(sim.list, ready.key, w, sim.format);
    if (championEntrantId) sim.champion = championEntrantId;
  }
  throw new Error('playOut did not converge');
}

const seedNum = (id: string): number => Number(id.replace('e', ''));
// Better seed (smaller number) wins — makes the top seed the deterministic champion.
const betterSeedWins =
  () =>
  (m: EngineMatch): Slot => {
    const a = m.entrantA ? seedNum(m.entrantA) : Infinity;
    const b = m.entrantB ? seedNum(m.entrantB) : Infinity;
    return a <= b ? 'A' : 'B';
  };

function assertAllResolved(sim: Sim): void {
  const unresolved = [...sim.map.values()].filter(
    (m) => m.status !== 'completed' && m.status !== 'bye',
  );
  expect(unresolved.map((m) => m.key)).toEqual([]);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('match keys are unique per bracket', () => {
  // The controller maps each match key → one ObjectId, so colliding keys would
  // produce duplicate _ids on insert. Pool play is the danger: N pools.
  const cases: Array<[string, GeneratedBracket]> = [
    ['single elim 8', generateSingleElimination(entrants(8))],
    ['single elim 5', generateSingleElimination(entrants(5))],
    ['double elim 8', generateDoubleElimination(entrants(8))],
    ['round robin 5', generateRoundRobin(entrants(5))],
    ['pool play 8/2/2', generatePoolPlay(entrants(8), { poolCount: 2, advancersPerPool: 2 })],
    ['pool play 12/3/2', generatePoolPlay(entrants(12), { poolCount: 3, advancersPerPool: 2 })],
  ];
  for (const [label, b] of cases) {
    it(label, () => {
      const keys = b.matches.map((m) => m.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  }
});

describe('helpers', () => {
  it('nextPow2', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(13)).toBe(16);
  });

  it('standardSeedOrder pairs 1 vs lowest', () => {
    expect(standardSeedOrder(2)).toEqual([1, 2]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    // Complementary pairs always sum to size+1.
    const order = standardSeedOrder(16);
    for (let i = 0; i < order.length; i += 2) {
      expect((order[i] ?? 0) + (order[i + 1] ?? 0)).toBe(17);
    }
  });
});

describe('single elimination', () => {
  it('power-of-two: correct round/match counts and a single champion', () => {
    const b = generateSingleElimination(entrants(8));
    expect(b.bracketSize).toBe(8);
    const r1 = b.matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    expect(b.matches).toHaveLength(7); // 4 + 2 + 1

    const sim = buildSim(b);
    playOut(sim, betterSeedWins());
    assertAllResolved(sim);
    expect(sim.champion).toBe('e1');
  });

  it('odd entrants (5): byes go to the top seeds and auto-advance to R2', () => {
    const b = generateSingleElimination(entrants(5));
    expect(b.bracketSize).toBe(8);
    // Three byes (8-5), each in its own R1 match, advancing seeds 1,2,3.
    const byes = b.matches.filter((m) => m.status === 'bye');
    expect(byes).toHaveLength(3);
    // No R1 match should have two byes.
    for (const m of b.matches.filter((x) => x.round === 1)) {
      expect(m.isByeA && m.isByeB).toBe(false);
    }
    const sim = buildSim(b);
    playOut(sim, betterSeedWins());
    assertAllResolved(sim);
    expect(sim.champion).toBe('e1');
  });

  it('handles 7 and 13 entrants', () => {
    for (const n of [7, 13]) {
      const b = generateSingleElimination(entrants(n));
      expect(b.bracketSize).toBe(nextPow2(n));
      const sim = buildSim(b);
      playOut(sim, betterSeedWins());
      assertAllResolved(sim);
    }
  });

  it('2 entrants: a single final', () => {
    const b = generateSingleElimination(entrants(2));
    expect(b.matches).toHaveLength(1);
    const sim = buildSim(b);
    playOut(sim, betterSeedWins());
    assertAllResolved(sim);
  });

  it('rejects fewer than 2 entrants', () => {
    expect(() => generateSingleElimination(entrants(1))).toThrow(BracketError);
  });
});

describe('double elimination', () => {
  it('size 8: correct section counts', () => {
    const b = generateDoubleElimination(entrants(8));
    expect(b.matches.filter((m) => m.bracket === 'winners')).toHaveLength(7);
    // Losers rounds for size 8 have counts [2,2,1,1] = 6 matches.
    expect(b.matches.filter((m) => m.bracket === 'losers')).toHaveLength(6);
    expect(b.matches.filter((m) => m.bracket === 'grand_final')).toHaveLength(2);
  });

  it('every non-terminal match wires to a real next match', () => {
    const b = generateDoubleElimination(entrants(8));
    const keys = new Set(b.matches.map((m) => m.key));
    for (const m of b.matches) {
      if (m.nextMatchKey) expect(keys.has(m.nextMatchKey)).toBe(true);
      if (m.nextLoserMatchKey) expect(keys.has(m.nextLoserMatchKey)).toBe(true);
    }
  });

  it('top seed wins it all with no grand-final reset', () => {
    const b = generateDoubleElimination(entrants(8));
    const sim = buildSim(b);
    playOut(sim, betterSeedWins());
    assertAllResolved(sim);
    const gf = sim.map.get('GF')!;
    expect(gf.winner).toBe('A'); // the undefeated winners champion
    expect(sim.map.get('GF2')!.status).toBe('bye'); // reset skipped
    expect(sim.champion).toBe('e1');
  });

  it('grand-final reset path: losers champion wins game 1, then the reset decides it', () => {
    const b = generateDoubleElimination(entrants(4));
    const sim = buildSim(b);
    // Play everything normally except force slot B to win the first grand final.
    const decide = (m: EngineMatch): Slot => {
      if (m.bracket === 'grand_final' && m.round === 1) return 'B';
      return betterSeedWins()(m);
    };
    playOut(sim, decide);
    assertAllResolved(sim);
    const gf2 = sim.map.get('GF2')!;
    expect(gf2.status).toBe('completed'); // the reset was actually played
    expect(gf2.winner).not.toBeNull();
    expect(sim.champion).not.toBeNull(); // champion comes from the reset match
  });

  // Rematches in the losers *final* (and grand final) are inherent to double
  // elimination — by then only one losers player remains. The crossing logic's
  // job is to avoid rematches in the EARLY losers rounds, which is what we check.
  it('size 8: early losers rounds avoid winners-bracket rematches', () => {
    const b = generateDoubleElimination(entrants(8));
    const lastLoserRound = Math.max(...b.matches.filter((m) => m.bracket === 'losers').map((m) => m.round));
    const sim = buildSim(b);
    const earlyLosersPairs = new Set<string>();
    const decide = (m: EngineMatch): Slot => {
      const w = betterSeedWins()(m);
      if (m.bracket === 'losers' && m.round < lastLoserRound) {
        earlyLosersPairs.add(pairKey(m.entrantA, m.entrantB));
      }
      return w;
    };
    playOut(sim, decide);
    for (const lp of earlyLosersPairs) expect(sim.winnersPairs.has(lp)).toBe(false);
  });

  it('size 16: early losers rounds avoid winners-bracket rematches', () => {
    const b = generateDoubleElimination(entrants(16));
    const lastLoserRound = Math.max(...b.matches.filter((m) => m.bracket === 'losers').map((m) => m.round));
    const sim = buildSim(b);
    const earlyLosersPairs = new Set<string>();
    const decide = (m: EngineMatch): Slot => {
      const w = betterSeedWins()(m);
      if (m.bracket === 'losers' && m.round < lastLoserRound) {
        earlyLosersPairs.add(pairKey(m.entrantA, m.entrantB));
      }
      return w;
    };
    playOut(sim, decide);
    assertAllResolved(sim);
    for (const lp of earlyLosersPairs) expect(sim.winnersPairs.has(lp)).toBe(false);
  });

  it('odd entrants (6): resolves to a champion', () => {
    const b = generateDoubleElimination(entrants(6));
    const sim = buildSim(b);
    playOut(sim, betterSeedWins());
    assertAllResolved(sim);
  });
});

describe('round robin', () => {
  it('4 entrants → every pair plays once (6 matches)', () => {
    const b = generateRoundRobin(entrants(4));
    expect(b.matches).toHaveLength(6);
    const pairs = new Set(b.matches.map((m) => pairKey(m.entrantA, m.entrantB)));
    expect(pairs.size).toBe(6);
  });

  it('5 entrants (odd) → C(5,2)=10 matches, no phantom matches', () => {
    const b = generateRoundRobin(entrants(5));
    expect(b.matches).toHaveLength(10);
    for (const m of b.matches) {
      expect(m.entrantA).not.toBeNull();
      expect(m.entrantB).not.toBeNull();
    }
  });

  it('standings rank by wins then point differential', () => {
    const b = generateRoundRobin(entrants(4));
    const completed: CompletedMatch[] = b.matches.map((m, i) => ({
      entrantA: m.entrantA,
      entrantB: m.entrantB,
      // e1 beats everyone; otherwise lower seed wins — deterministic order.
      winner: (seedNum(m.entrantA!) < seedNum(m.entrantB!) ? 'A' : 'B') as Slot,
      games: [{ a: i % 2 === 0 ? 11 : 5, b: i % 2 === 0 ? 5 : 11 }],
    }));
    const table = computeStandings(['e1', 'e2', 'e3', 'e4'], completed);
    expect(table[0]!.entrantId).toBe('e1');
    expect(table[0]!.rank).toBe(1);
    expect(table[0]!.wins).toBe(3);
    expect(table[3]!.entrantId).toBe('e4');
  });
});

describe('pool play', () => {
  it('8 entrants, 2 pools of 4, top 2 advance to a 4-team playoff', () => {
    const b = generatePoolPlay(entrants(8), { poolCount: 2, advancersPerPool: 2 });
    expect(b.pools).toHaveLength(2);
    expect(b.pools!.every((p) => p.entrantIds.length === 4)).toBe(true);
    expect(b.playoffSize).toBe(4);
    // Each pool: C(4,2)=6 RR matches → 12 total; playoff: 3 matches.
    expect(b.matches.filter((m) => m.bracket === 'main')).toHaveLength(12);
    expect(b.matches.filter((m) => m.bracket === 'playoff')).toHaveLength(3);
  });

  it('playoff round-1 slots carry seed sources that cross pools', () => {
    const b = generatePoolPlay(entrants(8), { poolCount: 2, advancersPerPool: 2 });
    const r1 = b.matches.filter((m) => m.bracket === 'playoff' && m.round === 1);
    for (const m of r1) {
      expect(m.seedSourceA).toBeDefined();
      expect(m.seedSourceB).toBeDefined();
      // The top match should pit a pool winner against a (different-pool) runner-up.
    }
    const top = r1.find((m) => m.slotInRound === 0)!;
    expect(top.seedSourceA!.poolKey).not.toBe(top.seedSourceB!.poolKey);
  });

  it('rejects too few entrants for the requested pools', () => {
    expect(() => generatePoolPlay(entrants(3), { poolCount: 2 })).toThrow(BracketError);
  });
});

describe('applyMatchResult', () => {
  const bo3 = { matchFormat: 'bo3' as const, pointsPerGame: 11 };

  it('derives the winner from best-of-3 game scores', () => {
    const r = applyMatchResult({ games: [{ a: 11, b: 7 }, { a: 9, b: 11 }, { a: 11, b: 6 }] }, bo3);
    expect(r.winner).toBe('A');
    expect(r.gamesA).toBe(2);
    expect(r.gamesB).toBe(1);
  });

  it('rejects a game not won by 2', () => {
    expect(() => applyMatchResult({ games: [{ a: 11, b: 10 }, { a: 11, b: 5 }] }, bo3)).toThrow(BracketError);
  });

  it('rejects a game that does not reach the cap', () => {
    expect(() => applyMatchResult({ games: [{ a: 8, b: 6 }, { a: 11, b: 5 }] }, bo3)).toThrow(BracketError);
  });

  it('rejects extra games once the match is already decided', () => {
    expect(() =>
      applyMatchResult({ games: [{ a: 11, b: 2 }, { a: 11, b: 3 }, { a: 11, b: 4 }] }, bo3),
    ).toThrow(BracketError);
  });

  it('rejects an unfinished match', () => {
    expect(() => applyMatchResult({ games: [{ a: 11, b: 2 }] }, bo3)).toThrow(BracketError);
  });

  it('accepts a walkover without score validation', () => {
    const r = applyMatchResult({ walkover: 'B' }, bo3);
    expect(r.winner).toBe('B');
  });

  it('bo1 needs exactly one decisive game', () => {
    const r = applyMatchResult({ games: [{ a: 15, b: 13 }] }, { matchFormat: 'bo1', pointsPerGame: 15 });
    expect(r.winner).toBe('A');
  });
});

describe('computeStandings tie-breakers', () => {
  it('uses head-to-head when two entrants are level on wins', () => {
    // e2 and e3 both beat e4 and lose to e1, but e3 beat e2 head-to-head.
    const m: CompletedMatch[] = [
      { entrantA: 'e1', entrantB: 'e2', winner: 'A', games: [{ a: 11, b: 0 }] },
      { entrantA: 'e1', entrantB: 'e3', winner: 'A', games: [{ a: 11, b: 0 }] },
      { entrantA: 'e1', entrantB: 'e4', winner: 'A', games: [{ a: 11, b: 0 }] },
      { entrantA: 'e2', entrantB: 'e4', winner: 'A', games: [{ a: 11, b: 0 }] },
      { entrantA: 'e3', entrantB: 'e4', winner: 'A', games: [{ a: 11, b: 0 }] },
      { entrantA: 'e2', entrantB: 'e3', winner: 'B', games: [{ a: 5, b: 11 }] },
    ];
    const table = computeStandings(['e1', 'e2', 'e3', 'e4'], m);
    expect(table.map((r) => r.entrantId)).toEqual(['e1', 'e3', 'e2', 'e4']);
  });
});
