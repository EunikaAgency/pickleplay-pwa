// What the CLIENT still owns for the Play feed: re-ordering the ranked set the
// server sent, and narrowing it with the filter sheet.
//
// The scoring suite moved with the scorer to api/src/features/play/playRanking.test.ts
// (37 cases — time fit, proximity, skill fit, fill pressure, the social signal, the
// cold-start renormalisation, and the "why" chips). Don't re-add scoring assertions
// here: a second implementation to satisfy them is exactly what moving it fixed.

import { describe, it, expect } from 'vitest';
import type { ApiGame, ScoredPlayItem } from '../../shared/lib/api';
import { countActiveGameFilters, makeDefaultGameFilters, matchesPlayFilters, type GameFilters } from './gameFilters';
import { sortScored, spotsLeft, startAt } from './playRanking';

const NOW = new Date('2026-07-09T12:00:00');

/** A ranked item as the server hands it back. Every field is already scored — the
 *  client's job starts here. */
function item(over: Partial<ScoredPlayItem> = {}): ScoredPlayItem {
  return {
    kind: 'game',
    id: 'g1',
    title: 'Evening doubles',
    date: '2026-07-10',
    startTime: '18:00',
    venueName: 'Makati Courts',
    venueLoc: 'Makati · Metro Manila',
    coords: null,
    skillBand: null,
    skillLabel: null,
    fill: { mode: 'capacity', joined: 0, cap: 4 },
    host: null,
    priceLabel: null,
    joinFee: null,
    visibility: 'public',
    isRecurring: false,
    image: null,
    createdAt: null,
    source: { id: 'g1', gameType: 'doubles' } as ApiGame,
    score: 0.5,
    distanceKm: null,
    why: [],
    ...over,
  };
}

const f = (over: Partial<GameFilters> = {}): GameFilters => ({ ...makeDefaultGameFilters(), ...over });

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

describe('spotsLeft', () => {
  it('reports the free seats on a capacity listing', () => {
    expect(spotsLeft(item({ fill: { mode: 'capacity', joined: 6, cap: 8 } }))).toBe(2);
  });

  it('has no answer for a full lobby, or for an interest-based listing with no capacity', () => {
    expect(spotsLeft(item({ fill: { mode: 'capacity', joined: 8, cap: 8 } }))).toBe(Infinity);
    expect(spotsLeft(item({ fill: { mode: 'interest', count: 3, target: null } }))).toBe(Infinity);
  });
});

describe('sortScored', () => {
  it('orders by the SERVER\'s relevance score under "best" — the client computes none', () => {
    const weak = item({ id: 'a', score: 0.2 });
    const strong = item({ id: 'b', score: 0.9 });
    expect(sortScored([weak, strong], 'best').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('sorts dateless listings last under "soonest"', () => {
    const dated = item({ id: 'a', date: '2026-07-20' });
    const dateless = item({ id: 'b', date: null });
    expect(sortScored([dateless, dated], 'soonest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts untimed listings after timed ones on the same date', () => {
    const timed = item({ id: 'a', date: '2026-07-10', startTime: '18:00' });
    const untimed = item({ id: 'b', date: '2026-07-10', startTime: null });
    expect(sortScored([untimed, timed], 'soonest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts listings with no distance last under "nearest"', () => {
    const near = item({ id: 'a', distanceKm: 1.1 });
    const nowhere = item({ id: 'b', distanceKm: null });
    expect(sortScored([nowhere, near], 'nearest').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts by spots remaining, ascending, under "Spots left"', () => {
    const one = item({ id: 'a', fill: { mode: 'capacity', joined: 7, cap: 8 } });
    const four = item({ id: 'b', fill: { mode: 'capacity', joined: 4, cap: 8 } });
    expect(sortScored([four, one], 'fill').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts full lobbies and capacity-less listings last under "Spots left"', () => {
    const open = item({ id: 'a', fill: { mode: 'capacity', joined: 6, cap: 8 } });
    const full = item({ id: 'b', fill: { mode: 'capacity', joined: 8, cap: 8 } });
    const interest = item({ id: 'c', fill: { mode: 'interest', count: 3, target: null } });
    const order = sortScored([full, interest, open], 'fill').map((i) => i.id);
    expect(order[0]).toBe('a');
    expect(order.slice(1).sort()).toEqual(['b', 'c']);
  });

  it('sorts the most recently added first under "newest"', () => {
    const older = item({ id: 'a', createdAt: '2026-07-01T10:00:00Z' });
    const newer = item({ id: 'b', createdAt: '2026-07-08T10:00:00Z' });
    expect(sortScored([older, newer], 'newest').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('is a total order — equal scores fall through to id, so renders are stable', () => {
    const a = item({ id: 'aaa' });
    const b = item({ id: 'bbb' });
    expect(a.score).toBe(b.score);
    expect(sortScored([b, a], 'best').map((i) => i.id)).toEqual(['aaa', 'bbb']);
    expect(sortScored([a, b], 'best').map((i) => i.id)).toEqual(['aaa', 'bbb']);
  });
});

describe('matchesPlayFilters — skill', () => {
  // The server cannot send Infinity (JSON has no such literal), so an open-ended
  // '4.0+' band arrives as [4, null] and `getPlayDiscover` restores the Infinity.
  // If that restoration ever regresses, this is the test that catches it: a null
  // upper bound would make the overlap check false and hide every 4.0+ listing.
  it('keeps an open-ended "4.0+" listing when the filter asks for 4.0+', () => {
    const advanced = item({ skillBand: [4.0, Infinity] });
    expect(matchesPlayFilters(advanced, f({ skill: '4.0+' }), NOW)).toBe(true);
  });

  it('drops a listing whose band does not overlap the requested one', () => {
    const beginners = item({ skillBand: [2.0, 2.5] });
    expect(matchesPlayFilters(beginners, f({ skill: '4.0+' }), NOW)).toBe(false);
  });

  it('never filters out a listing that declares no band — it is open to all levels', () => {
    expect(matchesPlayFilters(item({ skillBand: null }), f({ skill: '4.0+' }), NOW)).toBe(true);
  });
});

describe('matchesPlayFilters — "Pick a date"', () => {
  it('is inert until a date is chosen — tapping the chip must not empty the feed', () => {
    expect(matchesPlayFilters(item({ date: '2026-07-10' }), f({ when: 'custom' }), NOW)).toBe(true);
    expect(matchesPlayFilters(item({ date: '2026-08-30' }), f({ when: 'custom' }), NOW)).toBe(true);
  });

  it('matches only the chosen day once one is picked', () => {
    const filters = f({ when: 'custom', customDate: '2026-07-10' });
    expect(matchesPlayFilters(item({ date: '2026-07-10' }), filters, NOW)).toBe(true);
    expect(matchesPlayFilters(item({ date: '2026-07-11' }), filters, NOW)).toBe(false);
  });

  it('excludes a dateless listing when a specific day is requested', () => {
    expect(matchesPlayFilters(item({ date: null }), f({ when: 'custom', customDate: '2026-07-10' }), NOW)).toBe(false);
  });
});

describe('matchesPlayFilters — cost to join (§4.3)', () => {
  // The trap this filter exists to avoid. A GAME's priceLabel is the VENUE's hourly
  // rate — the host already paid it, and the app has no way to charge a joiner — so a
  // "Free" filter built on the label would hide a game that is genuinely free to join.
  // `joinFee: null` means "no join fee exists", and that is free.
  it('counts a player-hosted game as free even when its card shows the court rate', () => {
    const game = item({ joinFee: null, priceLabel: '₱350' });
    expect(matchesPlayFilters(game, f({ cost: 'free' }), NOW)).toBe(true);
    expect(matchesPlayFilters(game, f({ cost: 'paid' }), NOW)).toBe(false);
  });

  it('counts a ₱0 session as free', () => {
    const free = item({ kind: 'session', joinFee: 0, priceLabel: 'Free' });
    expect(matchesPlayFilters(free, f({ cost: 'free' }), NOW)).toBe(true);
    expect(matchesPlayFilters(free, f({ cost: 'paid' }), NOW)).toBe(false);
  });

  it('counts a session with a real fee as paid', () => {
    const paid = item({ kind: 'session', joinFee: 350, priceLabel: '₱350' });
    expect(matchesPlayFilters(paid, f({ cost: 'paid' }), NOW)).toBe(true);
    expect(matchesPlayFilters(paid, f({ cost: 'free' }), NOW)).toBe(false);
  });
});

describe('matchesPlayFilters — access, repeat, venue (§4.3)', () => {
  it('separates open listings from invitation-only ones', () => {
    expect(matchesPlayFilters(item({ visibility: 'invite' }), f({ access: 'invite' }), NOW)).toBe(true);
    expect(matchesPlayFilters(item({ visibility: 'invite' }), f({ access: 'public' }), NOW)).toBe(false);
    expect(matchesPlayFilters(item({ visibility: 'public' }), f({ access: 'public' }), NOW)).toBe(true);
  });

  it('separates a weekly series from a one-off', () => {
    expect(matchesPlayFilters(item({ isRecurring: true }), f({ repeat: 'recurring' }), NOW)).toBe(true);
    expect(matchesPlayFilters(item({ isRecurring: true }), f({ repeat: 'one-time' }), NOW)).toBe(false);
    expect(matchesPlayFilters(item({ isRecurring: false }), f({ repeat: 'one-time' }), NOW)).toBe(true);
  });

  it('narrows to one venue', () => {
    expect(matchesPlayFilters(item({ venueName: 'Makati Courts' }), f({ venue: 'Makati Courts' }), NOW)).toBe(true);
    expect(matchesPlayFilters(item({ venueName: 'Pasig Courts' }), f({ venue: 'Makati Courts' }), NOW)).toBe(false);
  });

  it('leaves every listing alone when none of them is set', () => {
    expect(matchesPlayFilters(item(), f(), NOW)).toBe(true);
    expect(countActiveGameFilters(f())).toBe(0);
  });

  it('badges each of the four when set', () => {
    expect(countActiveGameFilters(f({ cost: 'free' }))).toBe(1);
    expect(countActiveGameFilters(f({ access: 'invite' }))).toBe(1);
    expect(countActiveGameFilters(f({ repeat: 'recurring' }))).toBe(1);
    expect(countActiveGameFilters(f({ venue: 'Makati Courts' }))).toBe(1);
    expect(countActiveGameFilters(f({ cost: 'free', access: 'invite', repeat: 'recurring', venue: 'X' }))).toBe(4);
  });
});

describe('matchesPlayFilters — distance', () => {
  it('drops a listing beyond the radius', () => {
    expect(matchesPlayFilters(item({ distanceKm: 30 }), f({ radiusKm: 10 }), NOW)).toBe(false);
    expect(matchesPlayFilters(item({ distanceKm: 4 }), f({ radiusKm: 10 }), NOW)).toBe(true);
  });

  it('keeps a listing whose distance is unknown — hiding it would silently shrink the feed', () => {
    expect(matchesPlayFilters(item({ distanceKm: null }), f({ radiusKm: 10 }), NOW)).toBe(true);
  });
});

describe('countActiveGameFilters', () => {
  it('does not badge "Pick a date" before a date is chosen', () => {
    expect(countActiveGameFilters(f({ when: 'custom' }))).toBe(0);
    expect(countActiveGameFilters(f({ when: 'custom', customDate: '2026-07-10' }))).toBe(1);
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
    const d = makeDefaultGameFilters();
    expect([d.when, d.skill, d.gameType, d.openings, d.customDate]).toEqual(['any', 'Any', 'Any', false, null]);
  });
});
