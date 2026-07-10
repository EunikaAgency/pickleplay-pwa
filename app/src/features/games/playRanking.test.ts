import { describe, it, expect } from 'vitest';
import type { ApiGame, ApiOpenPlaySession } from '../../shared/lib/api';
import { countActiveGameFilters, makeDefaultGameFilters, matchesPlayFilters, type GameFilters } from './gameFilters';
import {
  fillPressure, gameToPlayItem, proximity, rankPlayFeed, scoreItem, sessionToPlayItem,
  skillFit, sortScored, startAt, timeFit,
  NEUTRAL_PROXIMITY, NEUTRAL_SKILL, SOON_PENALTY,
  type PlayItem, type RankContext,
} from './playRanking';

const NOW = new Date('2026-07-09T12:00:00');

/** A venue in Makati; ~1.1km away from MAKATI_NEARBY. */
const MAKATI: [number, number] = [14.5547, 121.0244];
const MAKATI_NEARBY: [number, number] = [14.5647, 121.0244];
/** ~60km south — comfortably past PROXIMITY_MAX_KM. */
const FAR: [number, number] = [14.0247, 121.0244];

function game(over: Partial<ApiGame> = {}): ApiGame {
  return { id: 'g1', gameType: 'doubles', date: '2026-07-10', startTime: '18:00', capacity: 4, participantCount: 0, ...over };
}
function session(over: Partial<ApiOpenPlaySession> = {}): ApiOpenPlaySession {
  return { id: 's1', seriesId: null, title: 'Evening drills', date: '2026-07-10', startTime: '18:00', capacity: 8, joinedCount: 0, ...over };
}
const ctx = (over: Partial<RankContext> = {}): RankContext => ({ now: NOW, userLoc: null, userSkill: null, ...over });

describe('startAt', () => {
  it('is null without a date', () => {
    expect(startAt({ date: null, startTime: '18:00' })).toBeNull();
  });

  it('treats a missing start time as end-of-day, so it sorts after timed listings', () => {
    const timed = startAt({ date: '2026-07-10', startTime: '18:00' })!;
    const untimed = startAt({ date: '2026-07-10', startTime: null })!;
    expect(untimed.getTime()).toBeGreaterThan(timed.getTime());
  });
});

describe('timeFit', () => {
  const at = (date: string, startTime: string) => timeFit(gameToPlayItem(game({ date, startTime })), NOW);

  it('scores a listing that already started as zero', () => {
    expect(at('2026-07-09', '09:00')).toBe(0);
  });

  it('decays with lead time', () => {
    expect(at('2026-07-10', '12:00')).toBeGreaterThan(at('2026-07-15', '12:00'));
  });

  it('scores past the 14-day horizon as zero', () => {
    expect(at('2026-08-30', '12:00')).toBe(0);
  });

  it('penalizes a game starting inside the 2h lead window', () => {
    const soon = at('2026-07-09', '13:00');  // 1h out
    const later = at('2026-07-09', '15:00'); // 3h out
    // Soon would otherwise score *higher* (less lead time); the penalty inverts that.
    expect(soon).toBeLessThan(later);
    expect(soon).toBeCloseTo((1 - 1 / (14 * 24)) * SOON_PENALTY, 5);
  });

  it('scores a dateless listing as zero rather than crashing', () => {
    expect(timeFit(gameToPlayItem(game({ date: null })), NOW)).toBe(0);
  });
});

describe('proximity', () => {
  it('is neutral — never zero — when the venue has no coordinates', () => {
    const item = gameToPlayItem(game({ venue: undefined }));
    expect(proximity(item, MAKATI)).toBe(NEUTRAL_PROXIMITY);
  });

  it('rewards a nearby venue over a far one', () => {
    const near = gameToPlayItem(game({ venue: { id: 'v', lat: MAKATI_NEARBY[0], lng: MAKATI_NEARBY[1] } }));
    const far = gameToPlayItem(game({ venue: { id: 'v', lat: FAR[0], lng: FAR[1] } }));
    expect(proximity(near, MAKATI)).toBeGreaterThan(0.9);
    expect(proximity(far, MAKATI)).toBe(0);
  });
});

describe('skillFit', () => {
  const withBand = (min: number | null, max: number | null) =>
    gameToPlayItem(game({ skillMin: min, skillMax: max }));

  it('is neutral for a listing with no skill band', () => {
    expect(skillFit(withBand(null, null), 3.5)).toBe(NEUTRAL_SKILL);
  });

  it('is perfect inside the band', () => {
    expect(skillFit(withBand(3.0, 3.5), 3.2)).toBe(1);
  });

  it('treats an open-ended band ("4.0+") as unbounded above', () => {
    expect(skillFit(withBand(4.0, null), 5.0)).toBe(1);
  });

  it('degrades with distance from the band but never hits zero', () => {
    const half = skillFit(withBand(3.0, 3.5), 4.0); // half a level out
    const full = skillFit(withBand(3.0, 3.5), 4.5); // a full level out
    expect(half).toBeCloseTo(0.6, 5);
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThan(half);
  });
});

describe('fillPressure', () => {
  const cap = (joined: number, capacity: number) =>
    fillPressure(sessionToPlayItem(session({ joinedCount: joined, capacity })));
  const interest = (count: number, target: number | null) =>
    fillPressure(gameToPlayItem(game({ gameType: 'open', interestedCount: count, targetPlayers: target })));

  it('peaks between 60% and 90% full', () => {
    expect(cap(6, 8)).toBe(1);      // 75%
    expect(cap(6, 8)).toBeGreaterThan(cap(1, 8));
    expect(cap(6, 8)).toBeGreaterThan(cap(8, 8));
  });

  it('ranks a completely full listing near the floor', () => {
    expect(cap(8, 8)).toBe(0.15);
  });

  it('ranks an empty listing above a full one, but below a filling one', () => {
    expect(cap(0, 8)).toBeGreaterThan(cap(8, 8));
    expect(cap(0, 8)).toBeLessThan(cap(5, 8));
  });

  // The correctness bug this module exists to avoid: interest-based open games
  // have no `capacity` at all. Scoring them on a fill ratio would penalize every
  // one of them for lacking a field they were never designed to have.
  it('never penalizes an interest-based game for having no capacity', () => {
    expect(interest(0, null)).toBeGreaterThanOrEqual(cap(0, 8));
    expect(interest(5, null)).toBeGreaterThan(cap(8, 8));
  });

  it('scores interest against the target when the host set one', () => {
    expect(interest(8, 8)).toBeGreaterThan(interest(2, 8));
    // Unlike a capacity listing, hitting the target is good news, not "full".
    expect(interest(8, 8)).toBe(1);
  });

  it('applies a soft, monotonic bump on raw interest when there is no target', () => {
    expect(interest(0, null)).toBeLessThan(interest(3, null));
    expect(interest(3, null)).toBeLessThan(interest(10, null));
    expect(interest(1000, null)).toBeLessThanOrEqual(0.9);
  });
});

describe('scoreItem — cold start', () => {
  const item = gameToPlayItem(game());

  it('collapses to timeFit + fillPressure when the user has no location or skill', () => {
    const s = scoreItem(item, ctx()).score;
    // Renormalised over 0.30 + 0.15 only.
    const expected = (0.30 * timeFit(item, NOW) + 0.15 * fillPressure(item)) / 0.45;
    expect(s).toBeCloseTo(expected, 6);
  });

  it('produces a total ordering for cold-start users rather than a flat one', () => {
    const soon = gameToPlayItem(game({ id: 'a', date: '2026-07-10' }));
    const later = gameToPlayItem(game({ id: 'b', date: '2026-07-18' }));
    expect(scoreItem(soon, ctx()).score).toBeGreaterThan(scoreItem(later, ctx()).score);
  });

  it('does not let a missing location drag every score down', () => {
    const cold = scoreItem(item, ctx()).score;
    const warm = scoreItem(item, ctx({ userLoc: MAKATI })).score;
    // A venue with no coords scores NEUTRAL_PROXIMITY, close to the cold score,
    // rather than zeroing the proximity term.
    expect(Math.abs(cold - warm)).toBeLessThan(0.2);
  });

  it('reports distance only when both sides have coordinates', () => {
    expect(scoreItem(item, ctx({ userLoc: MAKATI })).distanceKm).toBeNull();
    const located = gameToPlayItem(game({ venue: { id: 'v', lat: MAKATI_NEARBY[0], lng: MAKATI_NEARBY[1] } }));
    expect(scoreItem(located, ctx({ userLoc: MAKATI })).distanceKm).toBeCloseTo(1.1, 1);
  });
});

describe('scoreItem — social', () => {
  const friends = new Set(['friend-1']);

  it('is dropped entirely when there is no friend set', () => {
    const hosted = gameToPlayItem(game({ creatorId: 'friend-1' }));
    const notHosted = gameToPlayItem(game({ creatorId: 'stranger' }));
    expect(scoreItem(hosted, ctx()).score).toBe(scoreItem(notHosted, ctx()).score);
  });

  it('ranks a friend-hosted game above a stranger-hosted one', () => {
    const hosted = gameToPlayItem(game({ id: 'a', creatorId: 'friend-1' }));
    const stranger = gameToPlayItem(game({ id: 'b', creatorId: 'stranger' }));
    const c = ctx({ friendIds: friends });
    expect(scoreItem(hosted, c).score).toBeGreaterThan(scoreItem(stranger, c).score);
  });

  it('ranks a friend attending below a friend hosting', () => {
    const hosting = gameToPlayItem(game({ id: 'a', creatorId: 'friend-1' }));
    const attending = gameToPlayItem(game({ id: 'b', creatorId: 'x', participants: [{ id: 'friend-1' }] }));
    const c = ctx({ friendIds: friends });
    expect(scoreItem(hosting, c).score).toBeGreaterThan(scoreItem(attending, c).score);
  });
});

describe('why chips', () => {
  it('explains a close, on-level listing', () => {
    const item = gameToPlayItem(game({ skillMin: 3.0, skillMax: 3.5, venue: { id: 'v', lat: MAKATI_NEARBY[0], lng: MAKATI_NEARBY[1] } }));
    const why = scoreItem(item, ctx({ userLoc: MAKATI, userSkill: 3.2 })).why;
    expect(why).toContain('Your level');
    expect(why.some((w) => w.endsWith('away'))).toBe(true);
  });

  it('surfaces scarcity on a nearly-full lobby', () => {
    const item = sessionToPlayItem(session({ joinedCount: 7, capacity: 8 }));
    expect(scoreItem(item, ctx()).why).toContain('1 spot left');
  });

  it('caps at two reasons so the chip row stays readable', () => {
    const item = gameToPlayItem(game({
      skillMin: 3.0, skillMax: 3.5, capacity: 4, participantCount: 3,
      creatorId: 'friend-1', date: '2026-07-09', startTime: '15:00',
      venue: { id: 'v', lat: MAKATI_NEARBY[0], lng: MAKATI_NEARBY[1] },
    }));
    const why = scoreItem(item, ctx({ userLoc: MAKATI, userSkill: 3.2, friendIds: new Set(['friend-1']) })).why;
    expect(why.length).toBeLessThanOrEqual(2);
  });
});

describe('sortScored', () => {
  const mk = (over: Partial<PlayItem> & { id: string }) =>
    scoreItem({ ...gameToPlayItem(game()), ...over }, ctx({ userLoc: MAKATI }));

  it('sorts dateless listings last under "soonest"', () => {
    const dated = mk({ id: 'a', date: '2026-07-20' });
    const dateless = mk({ id: 'b', date: null });
    expect(sortScored([dateless, dated], 'soonest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts untimed listings after timed ones on the same date', () => {
    const timed = mk({ id: 'a', date: '2026-07-10', startTime: '18:00' });
    const untimed = mk({ id: 'b', date: '2026-07-10', startTime: null });
    expect(sortScored([untimed, timed], 'soonest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts coordinate-less listings last under "nearest"', () => {
    const near = mk({ id: 'a', coords: MAKATI_NEARBY });
    const nowhere = mk({ id: 'b', coords: null });
    expect(sortScored([nowhere, near], 'nearest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts by spots remaining, ascending, under "Spots left"', () => {
    const one = scoreItem(sessionToPlayItem(session({ id: 'a', joinedCount: 7, capacity: 8 })), ctx());
    const four = scoreItem(sessionToPlayItem(session({ id: 'b', joinedCount: 4, capacity: 8 })), ctx());
    expect(sortScored([four, one], 'fill').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts full lobbies and capacity-less listings last under "Spots left"', () => {
    const open = scoreItem(sessionToPlayItem(session({ id: 'a', joinedCount: 6, capacity: 8 })), ctx());
    const full = scoreItem(sessionToPlayItem(session({ id: 'b', joinedCount: 8, capacity: 8 })), ctx());
    const interest = scoreItem(gameToPlayItem(game({ id: 'c', gameType: 'open', interestedCount: 3 })), ctx());
    const order = sortScored([full, interest, open], 'fill').map((i) => i.id);
    expect(order[0]).toBe('a');
    expect(order.slice(1).sort()).toEqual(['b', 'c']);
  });

  it('is a total order — equal scores fall through to id, so renders are stable', () => {
    const a = mk({ id: 'aaa' });
    const b = mk({ id: 'bbb' });
    expect(a.score).toBe(b.score);
    expect(sortScored([b, a], 'best').map((i) => i.id)).toEqual(['aaa', 'bbb']);
    expect(sortScored([a, b], 'best').map((i) => i.id)).toEqual(['aaa', 'bbb']);
  });
});

describe('matchesPlayFilters — "Pick a date"', () => {
  const item = (date: string) => scoreItem(gameToPlayItem(game({ date })), ctx());
  const f = (over: Partial<GameFilters> = {}): GameFilters => ({ ...makeDefaultGameFilters(), ...over });

  it('is inert until a date is chosen — tapping the chip must not empty the feed', () => {
    expect(matchesPlayFilters(item('2026-07-10'), f({ when: 'custom' }), NOW)).toBe(true);
    expect(matchesPlayFilters(item('2026-08-30'), f({ when: 'custom' }), NOW)).toBe(true);
  });

  it('matches only the chosen day once one is picked', () => {
    const filters = f({ when: 'custom', customDate: '2026-07-10' });
    expect(matchesPlayFilters(item('2026-07-10'), filters, NOW)).toBe(true);
    expect(matchesPlayFilters(item('2026-07-11'), filters, NOW)).toBe(false);
  });

  it('excludes a dateless listing when a specific day is requested', () => {
    const dateless = scoreItem(gameToPlayItem(game({ date: null })), ctx());
    expect(matchesPlayFilters(dateless, f({ when: 'custom', customDate: '2026-07-10' }), NOW)).toBe(false);
  });
});

describe('countActiveGameFilters', () => {
  it('does not badge "Pick a date" before a date is chosen', () => {
    expect(countActiveGameFilters({ ...makeDefaultGameFilters(), when: 'custom' })).toBe(0);
    expect(countActiveGameFilters({ ...makeDefaultGameFilters(), when: 'custom', customDate: '2026-07-10' })).toBe(1);
  });

  // A distance filter can empty the feed on its own. If it isn't badged, the user
  // sees an empty list and no indication of why.
  it('badges the radius when one is set', () => {
    expect(countActiveGameFilters(makeDefaultGameFilters(10))).toBe(1);
  });

  it('badges nothing for a fresh filter set', () => {
    expect(countActiveGameFilters(makeDefaultGameFilters())).toBe(0);
  });
});

describe('default filters', () => {
  // Regression: the Play tab used to seed radiusKm from `preferences.searchRadiusKm`
  // (the Courts tab's 10km default), which silently hid every listing further away.
  it('applies no distance filter by default', () => {
    expect(makeDefaultGameFilters().radiusKm).toBeNull();
  });

  it('leaves every other filter unset', () => {
    const f = makeDefaultGameFilters();
    expect([f.when, f.skill, f.gameType, f.openings, f.customDate]).toEqual(['any', 'Any', 'Any', false, null]);
  });
});

describe('rankPlayFeed', () => {
  it('interleaves sessions and games rather than blocking them by type', () => {
    // The bug this whole feature exists to fix: a session weeks out used to
    // render above a game tonight, purely because sessions were concatenated first.
    const soonGame = game({ id: 'game-tonight', date: '2026-07-09', startTime: '19:00' });
    const farSession = session({ id: 'session-later', date: '2026-07-28' });
    const ranked = rankPlayFeed([soonGame], [farSession], ctx());
    expect(ranked.map((i) => i.id)).toEqual(['game-tonight', 'session-later']);
  });

  it('tags each item with its source kind for navigation', () => {
    const ranked = rankPlayFeed([game()], [session()], ctx());
    expect(new Set(ranked.map((i) => i.kind))).toEqual(new Set(['game', 'session']));
  });
});
