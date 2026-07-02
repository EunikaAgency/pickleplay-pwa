import { Schema, model } from 'mongoose';

// ─── Club ─────────────────────────────────────────────────────────────────
// A Discord-style community. Its detail page is a Facebook-style realtime feed
// (see ClubPost). memberCount/postCount are denormalized for cheap card render;
// they're mutated only via atomic $inc gated on a real row change (see the
// controller) so they don't drift under concurrent joins/posts.
const clubSchema = new Schema({
  name:          { type: String, required: true, maxlength: 120 },
  slug:          { type: String, required: true, unique: true },
  description:   { type: String, maxlength: 4000 },
  coverImageUrl: { type: String },
  hostId:        { type: Schema.Types.ObjectId, ref: 'User', required: true }, // creator / admin
  visibility:    { type: String, enum: ['public', 'private'], default: 'public' },
  joinLimit:     { type: Number, default: null },  // null = unlimited
  memberCount:   { type: Number, default: 1 },     // host counts from creation
  postCount:     { type: Number, default: 0 },
  isDeleted:     { type: Boolean, default: false },
}, { timestamps: true });

clubSchema.index({ slug: 1 }, { unique: true });
clubSchema.index({ visibility: 1, isDeleted: 1, createdAt: -1, _id: -1 }); // public browse cursor
clubSchema.index({ hostId: 1 });

export const Club = model('Club', clubSchema);

// ─── ClubMembership ──────────────────────────────────────────────────────
// One row per (club, user). Queried two ways: by club (member list) and by user
// (My Groups), so it's a collection, not an embedded array. Host gets a
// role:'host' row at club creation.
const clubMembershipSchema = new Schema({
  clubId:   { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String, enum: ['host', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

clubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true }); // idempotent join
clubMembershipSchema.index({ userId: 1, createdAt: -1 });               // My Groups
clubMembershipSchema.index({ clubId: 1, role: 1 });

export const ClubMembership = model('ClubMembership', clubMembershipSchema);

// ─── ClubPost (recursive) ────────────────────────────────────────────────
// One entity for top-level posts AND replies/comments — a reply is a full post
// (it can carry media, be liked, and be replied to). parentPostId=null is a
// top-level feed item; rootPostId is the top-level ancestor (lets a thread be
// fetched/cascaded in one query). Soft-deleted posts keep their replies intact
// and render as "deleted". reactionCount/replyCount are denormalized.
const attachmentSchema = new Schema({
  type: { type: String, enum: ['image', 'gif', 'game_link'], default: 'image' },
  url:       { type: String },                                // required for image/gif; optional thumbnail for game_link
  gameId:    { type: Schema.Types.ObjectId, ref: 'Game' },    // game_link only
  title:     { type: String, maxlength: 200 },               // game_link only — card headline
  subtitle:  { type: String, maxlength: 300 },               // game_link only — fallback detail line
  gameType:  { type: String, maxlength: 50 },                // game_link only — "Doubles" / "Singles" / "Open Play"
  skillLabel:{ type: String, maxlength: 50 },                // game_link only — "3.0–3.5" / "All levels"
  dateTime:  { type: String, maxlength: 100 },               // game_link only — "Today · 6:30 PM"
  venue:     { type: String, maxlength: 200 },               // game_link only — "The Dink Lab · Makati"
  spotsLeft: { type: Number },                               // game_link only — remaining spots
  capacity:  { type: Number },                               // game_link only — total spots
}, { _id: false });

const clubPostSchema = new Schema({
  clubId:       { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  authorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parentPostId: { type: Schema.Types.ObjectId, ref: 'ClubPost', default: null },
  rootPostId:   { type: Schema.Types.ObjectId, ref: 'ClubPost', default: null },
  body:         { type: String, maxlength: 8000 },  // emoji = native unicode here
  attachments:  { type: [attachmentSchema], default: [] },
  sharedPostId: { type: Schema.Types.ObjectId, ref: 'ClubPost', default: null }, // repost (reserved; V1 has no share endpoint)
  reactionCount: { type: Number, default: 0 },
  replyCount:    { type: Number, default: 0 },
  isDeleted:     { type: Boolean, default: false },
}, { timestamps: true });

// Serves BOTH the top-level feed (parentPostId:null) and replies-by-parent,
// each cursor-paginated by createdAt+_id DESC.
clubPostSchema.index({ clubId: 1, parentPostId: 1, createdAt: -1, _id: -1 });
clubPostSchema.index({ rootPostId: 1 });
clubPostSchema.index({ authorId: 1 });

export const ClubPost = model('ClubPost', clubPostSchema);

// ─── ClubPostReaction ────────────────────────────────────────────────────
// One row per (post, user). Unique index makes the like toggle idempotent and
// keeps the denormalized reactionCount correct under concurrent likes. The
// `type` enum leaves room for emoji reactions later (V1 is a single 'like').
const clubPostReactionSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'ClubPost', required: true },
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true }, // denormalized for keying/cleanup
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:   { type: String, enum: ['like'], default: 'like' },
}, { timestamps: true });

clubPostReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const ClubPostReaction = model('ClubPostReaction', clubPostReactionSchema);

// ─── ClubJoinRequest ─────────────────────────────────────────────────────
// Private clubs only. A denied/cancelled request keeps history without creating
// a membership row; approval creates the ClubMembership.
const clubJoinRequestSchema = new Schema({
  clubId:    { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:    { type: String, enum: ['pending', 'approved', 'denied', 'cancelled'], default: 'pending' },
  message:   { type: String, maxlength: 500 },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date },
}, { timestamps: true });

clubJoinRequestSchema.index({ clubId: 1, status: 1, createdAt: -1 }); // host pending queue
clubJoinRequestSchema.index({ clubId: 1, userId: 1 });

export const ClubJoinRequest = model('ClubJoinRequest', clubJoinRequestSchema);

// Two-way member group chat for a club (host + every member), separate from the
// feed. Mirrors the game-roster / tournament-roster chat (GameMessage /
// TournamentMessage); each send fans out a realtime event + a notification to
// the rest of the membership.
const gameLinkCardSchema = new Schema({
  gameId:    { type: Schema.Types.ObjectId, ref: 'Game' },
  title:     { type: String, maxlength: 200 },
  subtitle:  { type: String, maxlength: 300 },
  gameType:  { type: String, maxlength: 50 },
  skillLabel:{ type: String, maxlength: 50 },
  dateTime:  { type: String, maxlength: 100 },
  venue:     { type: String, maxlength: 200 },
  imageUrl:  { type: String },
  spotsLeft: { type: Number },
  capacity:  { type: Number },
}, { _id: false });

const clubMessageSchema = new Schema({
  clubId:   { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:     { type: String, default: '', maxlength: 4000 },
  card:     { type: gameLinkCardSchema, default: undefined },
}, { timestamps: true });

clubMessageSchema.index({ clubId: 1, createdAt: 1 });

export const ClubMessage = model('ClubMessage', clubMessageSchema);

// ── Per-club staff assignments ── like VenueStaff but for clubs. The club host
// (or someone with owner.staff.manage) can add a staff member to a specific club.
// Once added, the staff member can moderate that club (manage posts, members) but
// cannot delete the club or manage other staff.
const clubStaffSchema = new Schema({
  clubId:    { type: Schema.Types.ObjectId, ref: 'Club', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  staffRole: { type: String, maxlength: 30, default: 'moderator' },
  status:    { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

clubStaffSchema.index({ clubId: 1, userId: 1 }, { unique: true });
clubStaffSchema.index({ userId: 1, status: 1 });

export const ClubStaff = model('ClubStaff', clubStaffSchema);
