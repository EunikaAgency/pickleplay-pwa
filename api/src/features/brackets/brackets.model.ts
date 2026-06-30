import { Schema, model } from 'mongoose';

// Bracket competitive layer that sits on top of a Tournament (content feature).
// Three related models — one seedable Entrant per player/pair, one Bracket meta
// doc per tournament, and one doc per Match — kept in a single file (the
// venues.model.ts multi-export pattern). Match docs reference each other by
// _id for advancement so a result mutates one match plus its downstream slot.

// ── TournamentEntrant: the seedable unit (1 player = singles, 2 = doubles) ──
const tournamentEntrantSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    // 1-based seed; null until the organizer seeds the field.
    seed: { type: Number, default: null },
    // Denormalized label for the bracket UI, e.g. "A. Cruz / B. Reyes".
    displayName: { type: String, maxlength: 200, required: true },
    players: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        registrationId: { type: Schema.Types.ObjectId, ref: 'TournamentRegistration' },
        name: { type: String, maxlength: 120 },
      },
    ],
    status: { type: String, enum: ['active', 'withdrawn'], default: 'active' },
    seededManually: { type: Boolean, default: false },
  },
  { timestamps: true },
);

tournamentEntrantSchema.index({ tournamentId: 1, seed: 1 });

export const TournamentEntrant = model('TournamentEntrant', tournamentEntrantSchema);

// ── Bracket: one meta doc per tournament ────────────────────────────────────
export const BRACKET_FORMATS = [
  'single_elimination',
  'double_elimination',
  'round_robin',
  'pool_play',
] as const;

const bracketSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, unique: true },
    format: { type: String, enum: BRACKET_FORMATS, required: true },
    // Snapshotted from the Tournament at generation time so later edits to the
    // tournament don't change a live bracket's scoring rules.
    matchFormat: { type: String, enum: ['bo1', 'bo3', 'bo5'], default: 'bo3' },
    pointsPerGame: { type: Number, enum: [11, 15, 21], default: 11 },
    entrantCount: { type: Number, default: 0 },
    bracketSize: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'active', 'completed'], default: 'active' },
    // Flips to true once any score is entered — blocks regenerate + seed edits.
    locked: { type: Boolean, default: false },
    // pool_play only.
    pools: [
      {
        key: { type: String },
        label: { type: String },
        entrantIds: [{ type: Schema.Types.ObjectId, ref: 'TournamentEntrant' }],
        advancers: { type: Number },
      },
    ],
    playoffSize: { type: Number },
    playoffSeeded: { type: Boolean, default: false },
    championEntrantId: { type: Schema.Types.ObjectId, ref: 'TournamentEntrant', default: null },
    generatedAt: { type: Date },
  },
  { timestamps: true },
);

export const Bracket = model('Bracket', bracketSchema);

// ── BracketMatch: one doc per match ─────────────────────────────────────────
const gameScoreSchema = new Schema(
  { a: { type: Number, required: true }, b: { type: Number, required: true } },
  { _id: false },
);

const bracketMatchSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    bracketId: { type: Schema.Types.ObjectId, ref: 'Bracket', required: true },
    // Stable engine key (e.g. 'W-R1-M0') — handy for debugging + UI grouping.
    key: { type: String, required: true },
    // main = single-elim / round-robin; winners|losers|grand_final = double-elim;
    // playoff = pool-play knockout.
    bracket: {
      type: String,
      enum: ['winners', 'losers', 'grand_final', 'main', 'playoff'],
      default: 'main',
    },
    round: { type: Number, required: true },
    slotInRound: { type: Number, required: true },
    poolKey: { type: String, default: null },

    entrantA: { type: Schema.Types.ObjectId, ref: 'TournamentEntrant', default: null },
    entrantB: { type: Schema.Types.ObjectId, ref: 'TournamentEntrant', default: null },
    isByeA: { type: Boolean, default: false },
    isByeB: { type: Boolean, default: false },

    // Advancement wiring, resolved at generation time.
    nextMatchId: { type: Schema.Types.ObjectId, ref: 'BracketMatch', default: null },
    nextSlot: { type: String, enum: ['A', 'B', null], default: null },
    nextLoserMatchId: { type: Schema.Types.ObjectId, ref: 'BracketMatch', default: null },
    nextLoserSlot: { type: String, enum: ['A', 'B', null], default: null },

    games: { type: [gameScoreSchema], default: [] },
    winner: { type: String, enum: ['A', 'B', null], default: null },
    status: {
      type: String,
      enum: ['pending', 'ready', 'completed', 'bye'],
      default: 'pending',
    },
    isGrandFinalReset: { type: Boolean, default: false },
    // Pool-play playoff slots that get seeded from standings once pools finish.
    seedSourceA: { poolKey: String, rank: Number },
    seedSourceB: { poolKey: String, rank: Number },
  },
  { timestamps: true },
);

bracketMatchSchema.index({ tournamentId: 1, bracket: 1, round: 1, slotInRound: 1 });
bracketMatchSchema.index({ bracketId: 1 });

export const BracketMatch = model('BracketMatch', bracketMatchSchema);
