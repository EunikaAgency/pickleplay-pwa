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
  skillLabel:    { type: String, maxlength: 30 },         // verbatim, e.g. '3.0–3.5'
  skillMin:      Number,                                  // best-effort parse of skillLabel
  skillMax:      Number,
  whenLabel:     { type: String, maxlength: 30 },         // 'Tonight' | 'Tomorrow' | …
  timeLabel:     { type: String, maxlength: 20 },         // '6:30 PM'
  durationLabel: { type: String, maxlength: 20 },         // '2 hr'
  date:          { type: String },                        // computed YYYY-MM-DD (best-effort)
  capacity:      { type: Number, default: 4 },
  participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // Open Play interest: players who tapped "I'm Interested" (a soft signal, not a
  // committed roster). Only meaningful for gameType 'open'; capacity does not apply.
  interestedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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
