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
  participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // Open Play interest: players who tapped "I'm Interested" (a soft signal, not a
  // committed roster). Only meaningful for gameType 'open'; capacity does not apply.
  interestedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // Soft headcount target for open play ("aiming for 8"). Not a cap — interest
  // board shows progress toward this goal but anyone can still show interest.
  targetPlayers:  { type: Number },
  // Leave / join timing policy — per-lobby state machine (applies to lobby games:
  // singles/doubles/public; open play uses interest, not roster).
  fullAt:         { type: Date },                         // when the lobby became full (starts the 1h free-leave window)
  pendingLeaveUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], // players awaiting host approval to leave
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
