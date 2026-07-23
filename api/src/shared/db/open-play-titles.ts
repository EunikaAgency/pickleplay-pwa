// Realistic names for Open Play sessions and the Games they became.
//
// WHY
// The dummy seed named every session `${level} Open Play`, so four labels had to
// cover sixty rows: the Bookings screen showed "Advanced Open Play" a dozen times
// over, at a dozen different venues, and read as a placeholder rather than a
// listing. Real hosts don't name a session after its skill band — they name it
// after WHEN it runs and WHAT it is ("Tuesday Night Dinks", "Merienda Break
// Mixer"), and they only say the level out loud when it actually gates entry.
//
// HOW
// Compose a day/time flavour with a format noun instead of enumerating finished
// titles. Seven days x a handful of time words x ~16 formats is a few thousand
// plausible names, so `title()` can hand back a distinct one for every row in a
// seed without ever reaching for a numeric suffix.
//
// The time bucket comes from the session's own start hour, so an 07:00 row can
// only be called a morning thing and a 20:00 row can only be called a night one.

/** Sunday-first, matching `Date#getDay()`. */
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Bucket = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'latenight';

/**
 * Short enough to sit between a day name and a format noun. No word here may
 * restate the day — "Thursday Weeknight Rotation" says Thursday twice.
 */
const WHEN_ADJ: Record<Bucket, string[]> = {
  dawn: ['Sunrise', 'Early Bird', 'Dawn'],
  morning: ['Morning', 'Mid-Morning'],
  midday: ['Midday', 'Lunch Break'],
  afternoon: ['Afternoon', 'Golden Hour'],
  evening: ['Sunset', 'After-Work', 'Evening'],
  night: ['Night', 'Prime Time'],
  latenight: ['Late Night'],
};

/** Complete names on their own — a day name in front would overstuff them. */
const WHEN_PHRASE: Record<Bucket, string[]> = {
  dawn: ['Rise & Dink', 'Before-Work Warm-Ups', 'Sunrise Serves'],
  morning: ['Breakfast Club Rally', 'Morning Paddle Social', 'Coffee & Dinks'],
  midday: ['Merienda Break Mixer', 'High Noon Rotation', 'Lunch Hour Drop-In'],
  afternoon: ['Siesta Shake-Off', 'Golden Hour Games', 'Afternoon Paddle Jam'],
  evening: ['After-Office Open Play', 'Sunset Rotation', 'Post-Work Dink Fest'],
  night: ['Under the Lights', 'Weeknight Dink Fest', 'Floodlight Rotation'],
  latenight: ['Last Call Rally', 'Night Owl Doubles'],
};

/** Said out loud only when the level really is the point of the session. */
const LEVEL_FLAVOUR: Record<string, string[]> = {
  Beginner: ['Beginner-Friendly', 'First Timers', 'Learn-to-Play', 'Baby Dinkers'],
  Intermediate: ['Intermediate', '3.0–3.5', 'Next Step'],
  Advanced: ['Advanced', '4.0+', 'Competitive'],
  'Open / All levels': ['All Levels', 'Everyone Welcome', 'Open'],
};

const FORMATS = [
  'Open Play', 'Drop-In', 'Dinks', 'Rally', 'Round Robin', 'Doubles', 'Mixer',
  'Social', 'Rotation', 'Paddle Jam', 'Drills & Games', 'Ladder', 'Scramble',
  'Shootout', 'Kitchen Sessions', 'Rally Hour',
];

/**
 * A `Game.gameType` names a different kind of session, so it needs a different
 * noun: a 1v1 game called "Round Robin" is a contradiction, not a variation.
 * Unlisted types (and `open`) fall through to the drop-in pool above.
 */
const FORMATS_BY_TYPE: Record<string, string[]> = {
  singles: ['Singles', 'Singles Showdown', '1v1 Grind', 'Singles Ladder', 'Singles Scramble', 'Singles Tune-Up'],
  doubles: ['Doubles', 'Doubles Drill', 'Mixed Doubles', 'Doubles Rotation', 'Partner Hunt', 'Doubles Tune-Up'],
  // 'Ladder Play', not 'Ladder Night' — the time word is the caller's job, and a
  // 07:30 "Sunrise Ladder Night" contradicts itself.
  public: ['Round Robin', 'Bracket Battles', 'Mini Tourney', 'Ladder Play', 'Shootout', 'Pool Play'],
};

/** Weekend rows can carry these; a Tuesday one cannot. */
const WEEKEND_PHRASE = [
  'Weekend Warriors Round Robin', 'Saturday Sweat Session', 'Sunday Funday Doubles',
  'Weekend Paddle Social', 'Sunday Mini Tourney + Merienda',
];

function bucketFor(startHour: number): Bucket {
  // Manila sunrise is ~05:45 all year, so "Sunrise" stops meaning anything by 08:00.
  if (startHour < 8) return 'dawn';
  if (startHour < 11) return 'morning';
  if (startHour < 14) return 'midday';
  if (startHour < 17) return 'afternoon';
  // Split so a 20:00 game is never called a "Sunset" anything — in Manila the sun
  // is down by ~18:30 year-round.
  if (startHour < 19) return 'evening';
  if (startHour < 21) return 'night';
  return 'latenight';
}

/** `HH:MM` → hour. Anything unparseable is treated as an evening session. */
function hourOf(startTime: string | undefined): number {
  const h = Number(String(startTime ?? '').split(':')[0]);
  return Number.isFinite(h) ? h : 18;
}

/** `YYYY-MM-DD` → 0-6, or null when the date is missing/unparseable. */
function dayOf(date: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

export interface TitleInput {
  /** `YYYY-MM-DD`. Drives the day name and the weekend-only phrasings. */
  date?: string;
  /** `HH:MM`. Picks the time bucket, so the name can't contradict the clock. */
  startTime?: string;
  /** A `LEVELS` label — 'Beginner', 'Intermediate', 'Advanced', 'Open / All levels'. */
  levelLabel?: string;
  /** `Game.gameType`. Swaps the format nouns; omit for drop-in open play. */
  gameType?: string;
}

/**
 * One realistic title. Pass a shared `seen` set across a batch and every title
 * in that batch is distinct; the caller owns the set so a seed and a backfill
 * can be de-duplicated against each other.
 */
export function openPlayTitle(input: TitleInput, seen?: Set<string>, rng: () => number = Math.random): string {
  const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
  const bucket = bucketFor(hourOf(input.startTime));
  const dow = dayOf(input.date);
  const day = dow === null ? null : DAY_NAME[dow]!;
  const isWeekend = dow === 0 || dow === 6;
  const flavours = LEVEL_FLAVOUR[input.levelLabel ?? ''] ?? LEVEL_FLAVOUR['Open / All levels']!;
  const formats = FORMATS_BY_TYPE[input.gameType ?? ''] ?? FORMATS;
  // The standalone phrases are all drop-in flavoured ("Merienda Break Mixer"),
  // so they only fit open play — a singles match can't be a "Dink Fest".
  const dropIn = formats === FORMATS;

  const build = (): string => {
    // Weighted by hand: day+time+format is the most common real-world shape, so
    // it gets the most slots. The level-led patterns stay rarer on purpose.
    const patterns: Array<() => string> = [
      () => (day ? `${day} ${pick(WHEN_ADJ[bucket])} ${pick(formats)}` : `${pick(WHEN_ADJ[bucket])} ${pick(formats)}`),
      () => (day ? `${day} ${pick(WHEN_ADJ[bucket])} ${pick(formats)}` : `${pick(WHEN_ADJ[bucket])} ${pick(formats)}`),
      () => (day ? `${day} ${pick(formats)}` : `${pick(WHEN_ADJ[bucket])} ${pick(formats)}`),
      // Level + time + format only with one-word parts — "Open Lunch Break Doubles
      // Tune-Up" is five words and reads like a string concat, which it is.
      () => {
        const adjs = WHEN_ADJ[bucket].filter((w) => !w.includes(' '));
        const fls = flavours.filter((f) => !f.includes(' '));
        // 'Late Night' has no one-word form, so that bucket drops the time part.
        return adjs.length && fls.length
          ? `${pick(fls)} ${pick(adjs)} ${pick(formats)}`
          : `${pick(flavours)} ${pick(formats)}`;
      },
      () => (day ? `${pick(flavours)} ${day} ${pick(formats)}` : `${pick(flavours)} ${pick(formats)}`),
      ...(dropIn ? [() => pick(WHEN_PHRASE[bucket])] : []),
      ...(dropIn && isWeekend ? [() => pick(WEEKEND_PHRASE)] : []),
    ];
    return pick(patterns)();
  };

  let t = build();
  // The composed space is in the thousands, so this loop is a formality; the cap
  // exists so an exhausted pool degrades to a repeat instead of hanging.
  for (let guard = 0; seen?.has(t) && guard < 300; guard++) t = build();
  seen?.add(t);
  return t;
}
