import { Schema, model } from 'mongoose';

// A player-created open-play game (distinct from the organizer-published,
// read-only OpenPlaySession in content/). The creator is auto-added to
// participantIds, so they count toward the roster from the moment they post.
// spots-left is derived (capacity − participantIds.length), never stored.
const gameSchema = new Schema({
  creatorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title:         { type: String, maxlength: 120 },
  description:   { type: String, maxlength: 500 },
  // A real venue link is preferred; venueName is a free-text fallback for games
  // posted against a place that isn't in the venue directory.
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue' },
  venueName:     { type: String, maxlength: 120 },
  gameType:      { type: String, default: 'doubles' },   // 'singles' | 'doubles' | 'open' | 'public'
  // Competitive format for a 'public' game (null otherwise): how the session is run.
  format:        { type: String },                        // 'bracketing' | 'round_robin' | 'mini_tournament' | null
  // The vibe the host set — casual drop-in or competitive session.
  vibe:          { type: String },                        // 'casual' | 'competitive' | null
  // Who the host will admit. 'men'/'women' match the player's profile gender, so a
  // player with no gender set can't join a restricted game until they pick one.
  genderPolicy:  { type: String, default: 'all' },        // 'all' | 'men' | 'women'
  skillLabel:    { type: String, maxlength: 30 },         // verbatim, e.g. '3.0–3.5'
  skillMin:      Number,                                  // best-effort parse of skillLabel
  skillMax:      Number,
  whenLabel:     { type: String, maxlength: 30 },         // 'Tonight' | 'Tomorrow' | …
  timeLabel:     { type: String, maxlength: 20 },         // '6:30 PM'
  durationLabel: { type: String, maxlength: 20 },         // '2 hr'
  date:          { type: String },                        // computed YYYY-MM-DD (best-effort)
  // Sortable 24h 'HH:MM', materialized from the linked Booking (or parsed from
  // timeLabel when there's none). Mirrors OpenPlaySession.startTime so the two
  // collections share one {date, startTime} sort shape. Null when unknowable —
  // such games sort last within their date.
  startTime:     { type: String, maxlength: 5 },
  capacity:      { type: Number, default: 4 },
  // Open Play join fee in pesos. 0 = free (the default for every player). A price
  // above 0 is only ever set by a subscribed organizer, who keeps 100% of it —
  // the platform's only cut is the 7% on the court booking. Gated server-side in
  // createGame; a non-organizer can never store a non-zero fee.
  joinFee:       { type: Number, default: 0 },
  participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // LEGACY. Open Play interest: players who tapped "I'm Interested" (a soft signal,
  // not a committed roster). Since the merge, Open Play takes a real roster seat in
  // participantIds through joinGame like every other gameType — capacity, gender,
  // and skill guards all apply. Kept only so old rows keep their history; nothing
  // reads it as a roster any more.
  interestedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // LEGACY. Soft headcount goal for open play ("aiming for 8"). Never a cap —
  // `capacity` is the cap for every gameType. Some pre-merge open-play rows stored
  // their real cap here and left `capacity` unset; see `seats()` in the controller.
  targetPlayers:  { type: Number },
  // Leave / join timing policy — per-lobby state machine. Applies to every
  // gameType, open play included (it has a real roster since the merge).
  fullAt:         { type: Date },                         // when the lobby became full (starts the 1h free-leave window)
  pendingLeaveUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], // players awaiting host approval to leave
  // Host-gated joining. When true, a join lands in pendingJoinUserIds and the host
  // must approve before the player takes a seat. Opt-in per lobby and default off,
  // so every existing game keeps today's open-join behaviour with no backfill.
  // Can be switched off platform-wide via AppSettings.allowPlayerApprovalLobbies.
  requiresApproval: { type: Boolean, default: false },
  // Players who asked to join and are awaiting the host's decision. They hold NO
  // seat: capacity, spotsLeft, the roster, and chat access all read participantIds,
  // so a pending player is invisible to every one of them. Deliberately survives a
  // full lobby — that is the waiting list, so the host can admit from the queue if
  // someone drops.
  pendingJoinUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // A rolling log of leaves this lobby has seen: { user, leftAt }. The most recent
  // two entries per user drive the 1h re-join cooldown.
  leaveLog:       [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, leftAt: { type: Date, default: Date.now } }],
  // Players who have been invited. Each entry records who was invited and who
  // sent the invite, so the invitee can see the inviter's name and re-invites
  // (same user by same inviter) dedupe. Joining is still via the normal flow.
  invitedUserIds: [{
    user:      { type: Schema.Types.ObjectId, ref: 'User' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  }],
  visibility:    { type: String, default: 'public' },     // 'public' | 'invite'
  // Lifecycle: a game is created at a fixed venue and is immediately joinable.
  status:        { type: String, default: 'published' },  // 'published' (filling) | 'full' | 'cancelled'
  // The host's court reservation, made + paid when the game is created.
  bookingId:      { type: Schema.Types.ObjectId, ref: 'Booking' },
}, { timestamps: true });

gameSchema.index({ status: 1, date: 1 });
gameSchema.index({ status: 1, date: 1, startTime: 1 });
gameSchema.index({ creatorId: 1 });
gameSchema.index({ participantIds: 1 });
gameSchema.index({ interestedUserIds: 1 });

export const Game = model('Game', gameSchema);

/**
 * The only account kind a game invite may target (`User.roleDefault`).
 *
 * Invites run one way: an owner may invite a player, but a player may not invite
 * an owner — owner-side accounts (owner/staff/admin) run venues rather than play
 * in them, and organizers run events. So the rule collapses to "invitees are
 * players", which needs no inviter-role branching. Coaches keep roleDefault
 * 'player' (coach is a granted role), so they stay invitable.
 */
export const INVITABLE_ROLE = 'player';

// Group chat for a game's roster (host + joined players). Distinct from the 1:1
// `messages` feature — this is many-to-many scoped to one game. Read/post is
// gated to roster members in the controller; realtime fan-out goes through the
// shared per-user event bus (game.message.created).
const gameMessageSchema = new Schema({
  gameId:   { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:     { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });

gameMessageSchema.index({ gameId: 1, createdAt: 1 });

export const GameMessage = model('GameMessage', gameMessageSchema);
