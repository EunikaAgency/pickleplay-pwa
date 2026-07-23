export interface SkillTier {
  id: 'new' | 'improving' | 'solid' | 'competitive';
  name: string;
  blurb: string;
  dupr: string;
  detail: string;
}

/** The skill labels hosts can assign to a game or Open Play lobby. Shared by
 * booking, creation, and editing so those surfaces always offer the same set. */
export const GAME_SKILL_OPTIONS = ['Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+', 'Open'] as const;

export const skillTiers: SkillTier[] = [
  {
    id: 'new',
    name: 'New',
    blurb: 'Still learning to keep score',
    dupr: 'DUPR 1.0 – 2.5',
    detail:
      "You're brand new to pickleball or just getting consistent on serves. Look for games tagged 'Beginners Welcome' — you'll have a great time.",
  },
  {
    id: 'improving',
    name: 'Improving',
    blurb: 'Consistent rallies, learning strategy',
    dupr: 'DUPR 2.5 – 3.0',
    detail:
      "You rally with control, serve in, and you're starting to understand third-shot drops and dink rallies. Games at this level focus on consistency over power.",
  },
  {
    id: 'solid',
    name: 'Solid',
    blurb: 'Strategic play, sustained dinks',
    dupr: 'DUPR 3.0 – 3.5',
    detail:
      "You move purposefully at the kitchen line, dink with intent, and call shots with your partner. Ready for most rec games in your area.",
  },
  {
    id: 'competitive',
    name: 'Competitive',
    blurb: 'Tournament-level play',
    dupr: 'DUPR 3.5+',
    detail:
      "Strong shot selection, fast hands, and tournament experience. You can play with anyone at the rec center and you're looking for sharper games.",
  },
];

export function tierForDupr(dupr: number): SkillTier {
  if (dupr < 2.5) return skillTiers[0];
  if (dupr < 3.0) return skillTiers[1];
  if (dupr < 3.5) return skillTiers[2];
  return skillTiers[3];
}

// A representative DUPR for each tier — the midpoint of the tier's range — used
// when we only have a tier (onboarding / edit-profile picker) but the account
// stores a numeric `skillLevel`. Chosen so `tierForDupr(duprForTier(id)) === id`.
const TIER_DUPR: Record<SkillTier['id'], number> = {
  new: 2.0,
  improving: 2.75,
  solid: 3.25,
  competitive: 3.75,
};

export function duprForTier(id: SkillTier['id']): number {
  return TIER_DUPR[id];
}
