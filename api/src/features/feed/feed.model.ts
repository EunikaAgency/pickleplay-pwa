import { Schema, model } from 'mongoose';

// ─── FeedPost (recursive, global) ─────────────────────────────────────────
// The global PickleFeed — a Threads/Facebook-style player newsfeed. It reuses
// the club-feed shape (see ClubPost) but drops `clubId`: a post here belongs to
// everyone, not a club. One entity for top-level posts AND replies/comments
// (parentPostId=null is a top-level feed item; rootPostId is the top-level
// ancestor). `sharedPostId` is a repost of another user's post ("share ng post
// ng iba"). Soft-deleted posts keep their replies and render as "deleted".
// reactionCount/replyCount are denormalized for cheap card render.
//
// `attachments` carries a share CARD — a snapshot of a public Game, an
// OpenPlaySession, or a Club — so tapping it opens (and lets others join) that
// entity. The card fields are denormalized at post time by the server (never
// trusted from the client) so a feed page renders without N extra look-ups; the
// live entity is re-fetched only when the viewer taps through via `refId`.
const attachmentSchema = new Schema({
  // A share CARD ('game' | 'open_play' | 'club', identified by refId) or an
  // uploaded MEDIA item ('image' | 'gif', identified by url). Photos are allowed
  // on posts + comments; GIFs only on comments (enforced in the controller).
  type:      { type: String, enum: ['game', 'open_play', 'club', 'image', 'gif'], required: true },
  refId:     { type: Schema.Types.ObjectId },                   // share cards: the game/session/club to open + join
  url:       { type: String, maxlength: 1000 },                 // media: the servable image/GIF path
  title:     { type: String, maxlength: 200 },                  // card headline (game/session title, club name)
  subtitle:  { type: String, maxlength: 300 },                  // fallback detail line (description)
  imageUrl:  { type: String, maxlength: 1000 },                 // venue/cover thumbnail
  gameType:  { type: String, maxlength: 50 },                   // "Doubles" / "Open Play" / "Public"
  skillLabel:{ type: String, maxlength: 50 },                   // "3.0–3.5" / "All levels"
  dateTime:  { type: String, maxlength: 100 },                  // "Today · 6:30 PM"
  venue:     { type: String, maxlength: 200 },                  // "The Dink Lab · Makati"
  spotsLeft: { type: Number },                                  // game/session remaining spots
  capacity:  { type: Number },                                  // game/session total spots
  memberCount:{ type: Number },                                 // club only
}, { _id: false });

const feedPostSchema = new Schema({
  authorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parentPostId: { type: Schema.Types.ObjectId, ref: 'FeedPost', default: null }, // null = top-level
  rootPostId:   { type: Schema.Types.ObjectId, ref: 'FeedPost', default: null },
  body:         { type: String, maxlength: 8000 },  // emoji = native unicode
  attachments:  { type: [attachmentSchema], default: [] },
  sharedPostId: { type: Schema.Types.ObjectId, ref: 'FeedPost', default: null }, // repost target
  reactionCount:{ type: Number, default: 0 },
  replyCount:   { type: Number, default: 0 },
  isDeleted:    { type: Boolean, default: false },
}, { timestamps: true });

// Serves BOTH the top-level feed (parentPostId:null) and replies-by-parent,
// each cursor-paginated by createdAt+_id DESC (see shared/lib/cursor.ts).
feedPostSchema.index({ parentPostId: 1, isDeleted: 1, createdAt: -1, _id: -1 });
feedPostSchema.index({ rootPostId: 1 });
feedPostSchema.index({ authorId: 1 });

export const FeedPost = model('FeedPost', feedPostSchema);

// ─── FeedPostReaction ─────────────────────────────────────────────────────
// One row per (post, user). Unique index makes the like toggle idempotent and
// keeps the denormalized reactionCount correct under concurrent likes.
const feedPostReactionSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:   { type: String, enum: ['like'], default: 'like' },
}, { timestamps: true });

feedPostReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const FeedPostReaction = model('FeedPostReaction', feedPostReactionSchema);

// ─── FeedSignal ─────────────────────────────────────────────────────────────
// A viewer's per-author feed preference. `interested` floats that author's posts
// to the top of each feed page (de-clustered so they're never back-to-back) and
// keeps them exempt from muting; `not_interested` mutes the author from the
// viewer's feed. One row per (userId, authorId) — the latest tap wins.
const feedSignalSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:     { type: String, enum: ['interested', 'not_interested'], required: true },
}, { timestamps: true });

feedSignalSchema.index({ userId: 1, authorId: 1 }, { unique: true });

export const FeedSignal = model('FeedSignal', feedSignalSchema);

// ─── FeedHiddenPost ─────────────────────────────────────────────────────────
// "Hide post (for a day)" — a viewer-scoped, time-boxed hide. The feed filters
// out posts whose `hiddenUntil` is still in the future; past that they reappear.
const feedHiddenPostSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postId:      { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
  hiddenUntil: { type: Date, required: true },
}, { timestamps: true });

feedHiddenPostSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const FeedHiddenPost = model('FeedHiddenPost', feedHiddenPostSchema);

// ─── FeedReport ─────────────────────────────────────────────────────────────
// A user's report of a post (for later moderation review). One row per
// (userId, postId) — a repeat report just refreshes the reason.
const feedReportSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },   // the reporter
  postId:     { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
  reason:     { type: String, maxlength: 500 },
  // Moderation lifecycle, mirroring ReviewReport: pending → resolved | dismissed.
  status:     { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

feedReportSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const FeedReport = model('FeedReport', feedReportSchema);

// ─── FeedNotifySub ──────────────────────────────────────────────────────────
// "Turn on notifications for this post" — the viewer is notified when someone
// comments on it. One row per (userId, postId).
const feedNotifySubSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
}, { timestamps: true });

feedNotifySubSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const FeedNotifySub = model('FeedNotifySub', feedNotifySubSchema);
