import { Schema, model } from 'mongoose';

const openPlaySessionSchema = new Schema({
  slug:           { type: String, unique: true, maxlength: 100 },
  title:          { type: String, required: true, maxlength: 200 },
  venueId:        { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  cityId:         { type: Schema.Types.ObjectId, ref: 'City' },
  // Organizer ownership + series link (added for organizer-managed recurring
  // open play; legacy editorial/import rows leave these unset).
  organizerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  seriesId:        { type: Schema.Types.ObjectId, ref: 'OpenPlaySeries' },
  date:           { type: String, required: true },
  startTime:      { type: String, required: true },
  endTime:        String,
  levelLabel:     { type: String, maxlength: 50 },
  levelColor:     { type: String, maxlength: 7 },
  skillLevelMin:  Number,
  skillLevelMax:  Number,
  price:          { type: Number, required: true },
  capacity:       { type: Number, required: true },
  joinedCount:    { type: Number, default: 0 },
  status:         { type: String, default: 'published' }, // published | cancelled | completed
  organizerName:  { type: String, maxlength: 200 },
  organizerType:  { type: String, maxlength: 20 },
  isRecurring:    { type: Boolean, default: false },
  recurrenceRule: String,
  description:    String,
  tags:           [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

openPlaySessionSchema.index({ venueId: 1, date: 1 });
openPlaySessionSchema.index({ organizerUserId: 1, date: 1 });
openPlaySessionSchema.index({ seriesId: 1, date: 1 });

export const OpenPlaySession = model('OpenPlaySession', openPlaySessionSchema);

// A recurring open-play template owned by an organizer. Creating a series
// stamps out individual OpenPlaySession instances over a horizon (weeksAhead);
// the organizer manages the series in one place and can cancel single instances
// (e.g. weather) without ending the series. `organizer.events.manage` gates it.
const openPlaySeriesSchema = new Schema({
  organizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title:           { type: String, required: true, maxlength: 200 },
  venueId:         { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  daysOfWeek:      [{ type: Number }],                  // 0 (Sun) – 6 (Sat)
  startTime:       { type: String, required: true },    // "18:30"
  endTime:         String,
  levelLabel:      { type: String, maxlength: 50 },
  skillLevelMin:   Number,
  skillLevelMax:   Number,
  price:           { type: Number, default: 0 },
  capacity:        { type: Number, default: 8 },
  description:     String,
  weeksAhead:      { type: Number, default: 8 },         // generation horizon
  status:          { type: String, default: 'active' },  // active | cancelled
}, { timestamps: true });

openPlaySeriesSchema.index({ organizerUserId: 1, createdAt: -1 });

export const OpenPlaySeries = model('OpenPlaySeries', openPlaySeriesSchema);

// A player's spot in an open-play session instance. Mirrors
// TournamentRegistration so the same attendance/waitlist logic applies.
const openPlayRegistrationSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'OpenPlaySession', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:    { type: String, enum: ['registered', 'waitlisted'], default: 'registered' },
  attended:  { type: Boolean, default: false },   // marked at check-in (feature: attendance)
  paid:      { type: Boolean, default: false },   // organizer payment ledger
  paymentNote: { type: String, maxlength: 200 },
}, { timestamps: true });

openPlayRegistrationSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const OpenPlayRegistration = model('OpenPlayRegistration', openPlayRegistrationSchema);

// Group chat for one open-play session (organizer + everyone who joined).
// Mirrors GameMessage/TournamentMessage: read+post are gated to the roster in
// the controller, and each send fans out a realtime event + a notification.
const openPlayMessageSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'OpenPlaySession', required: true },
  senderId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:      { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });

openPlayMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const OpenPlayMessage = model('OpenPlayMessage', openPlayMessageSchema);

// Status flow for organizer-created tournaments:
//   draft → pending_venue_approval → approved → registration_open
//         → ongoing → completed; plus cancelled / rejected branches.
// Legacy editorial/import rows use 'open' and are left untouched.
export const TOURNAMENT_STATUSES = [
  'draft', 'pending_venue_approval', 'approved', 'registration_open',
  'ongoing', 'completed', 'cancelled', 'rejected', 'open',
] as const;

const tournamentSchema = new Schema({
  slug:              { type: String, required: true, unique: true, maxlength: 100 },
  name:              { type: String, required: true, maxlength: 200 },
  // Optional until the organizer's venue request is approved (drafts have no
  // venue yet). The editorial importer always supplies one.
  venueId:           { type: Schema.Types.ObjectId, ref: 'Venue' },
  cityId:            { type: Schema.Types.ObjectId, ref: 'City' },
  // The user who owns this tournament (organizer). Absent on legacy editorial rows.
  organizerUserId:   { type: Schema.Types.ObjectId, ref: 'User' },
  startDate:         String,
  endDate:           String,
  startTime:         String,
  endTime:           String,
  // Registration window + day-of schedule.
  registrationOpenDate:  String,
  registrationCloseDate: String,
  checkInTime:       String,
  matchStartTime:    String,
  // Classification.
  tournamentType:    { type: String, enum: ['singles', 'doubles', 'mixed', 'team'] },
  skillLevel:        { type: String, maxlength: 50 },
  ageDivision:       { type: String, maxlength: 100 },
  genderDivision:    { type: String, maxlength: 100 },
  // Format.
  format:            { type: String, maxlength: 100 },
  matchFormat:       { type: String, enum: ['bo1', 'bo3', 'bo5'] },
  pointsPerGame:     { type: Number, enum: [11, 15, 21] },
  // Registration settings.
  price:             { type: Number, default: 0 },
  maxPlayers:        Number,
  allowWaitlist:     { type: Boolean, default: false },
  registeredPlayers: { type: Number, default: 0 },
  courtsRequired:    Number,
  status:            { type: String, enum: TOURNAMENT_STATUSES, default: 'draft' },
  visibility:        { type: String, enum: ['public', 'private', 'invite_only'], default: 'public' },
  description:       String,
  // Prizes — structured fields supplement the legacy free-text prizeInfo.
  prizeChampion:     String,
  prizeRunnerUp:     String,
  prizeThird:        String,
  prizeInfo:         String,
  // Contact + policies.
  organizer:         { type: String, maxlength: 200 },
  organizerName:     { type: String, maxlength: 200 },
  organizerPhone:    { type: String, maxlength: 50 },
  contactEmail:      { type: String, maxlength: 255 },
  rules:             String,
  refundPolicy:      String,
  registrationUrl:   String,
  isFeatured:        { type: Boolean, default: false },
  imageUrl:          String,
  bannerUrl:         String,
  tags:              [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

tournamentSchema.index({ slug: 1 });
// Organizer's "my tournaments" list, newest first.
tournamentSchema.index({ organizerUserId: 1, createdAt: -1 });

export const Tournament = model('Tournament', tournamentSchema);

const eventSchema = new Schema({
  slug:            { type: String, required: true, unique: true, maxlength: 100 },
  name:            { type: String, required: true, maxlength: 200 },
  venueId:         { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  cityId:          { type: Schema.Types.ObjectId, ref: 'City' },
  date:            String,
  endDate:         String,
  startTime:       String,
  endTime:         String,
  recurrenceText:  { type: String, maxlength: 200 },
  eventType:       { type: String, maxlength: 30 },
  price:           { type: Number, required: true },
  description:     String,
  organizer:       { type: String, maxlength: 200 },
  capacity:        Number,
  registeredCount: { type: Number, default: 0 },
  status:          { type: String, default: 'published' },
  imageUrl:        String,
  tags:            [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

eventSchema.index({ slug: 1 });

export const Event = model('Event', eventSchema);

const tournamentRegistrationSchema = new Schema({
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // 'registered' = confirmed spot; 'waitlisted' = full but waitlist allowed;
  // 'pending' = awaiting organizer approval (invite-only tournaments).
  status:       { type: String, enum: ['registered', 'waitlisted', 'pending'], default: 'registered' },
  attended:     { type: Boolean, default: false },   // marked at check-in
  paid:         { type: Boolean, default: false },   // organizer payment ledger
  paymentNote:  { type: String, maxlength: 200 },
}, { timestamps: true });

// One registration per player per tournament — blocks double sign-up.
tournamentRegistrationSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });

export const TournamentRegistration = model('TournamentRegistration', tournamentRegistrationSchema);

// Organizer → participants broadcasts for a tournament (schedule changes, venue
// moves, general notices). Stored as a durable feed; each send also fans out a
// Notification to every registrant. `kind` drives the icon/label in the UI.
const tournamentAnnouncementSchema = new Schema({
  tournamentId:    { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  organizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind:            { type: String, enum: ['general', 'schedule', 'venue'], default: 'general' },
  title:           { type: String, required: true, maxlength: 200 },
  body:            { type: String, required: true, maxlength: 4000 },
  recipientCount:  { type: Number, default: 0 },
}, { timestamps: true });

tournamentAnnouncementSchema.index({ tournamentId: 1, createdAt: -1 });

export const TournamentAnnouncement = model('TournamentAnnouncement', tournamentAnnouncementSchema);

// Two-way participant group chat for a tournament (organizer + every registrant).
// Mirrors the game-roster chat (GameMessage); each send fans out a realtime
// event + a notification to the rest of the roster.
const tournamentMessageSchema = new Schema({
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  senderId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:         { type: String, required: true, maxlength: 4000 },
}, { timestamps: true });

tournamentMessageSchema.index({ tournamentId: 1, createdAt: 1 });

export const TournamentMessage = model('TournamentMessage', tournamentMessageSchema);

const eventRegistrationSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:  { type: String, default: 'pending' },
}, { timestamps: true });

export const EventRegistration = model('EventRegistration', eventRegistrationSchema);

const postSchema = new Schema({
  slug:            { type: String, required: true, unique: true, maxlength: 150 },
  title:           { type: String, required: true, maxlength: 300 },
  subtitle:        { type: String, maxlength: 300 },
  postType:        { type: String, maxlength: 30 },
  status:          { type: String, default: 'draft' },
  summary:         String,
  content:         { type: String, required: true },
  heroImageUrl:    String,
  thumbnailUrl:    String,
  readTime:        { type: String, maxlength: 20 },
  seriesId:        { type: Schema.Types.ObjectId, ref: 'Series' },
  publishedAt:     Date,
  isFeatured:      { type: Boolean, default: false },
  metaTitle:       { type: String, maxlength: 70 },
  metaDescription: { type: String, maxlength: 160 },
  tableOfContents: Schema.Types.Mixed,
  canonicalUrl:    String,
  authors:         [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, role: { type: String, default: 'author' }, sortOrder: Number }],
  tags:            [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
}, { timestamps: true });

postSchema.index({ slug: 1 });

export const Post = model('Post', postSchema);

const seriesSchema = new Schema({
  slug:        { type: String, required: true, unique: true, maxlength: 100 },
  title:       { type: String, required: true, maxlength: 200 },
  description: String,
  postType:    { type: String, maxlength: 20 },
  imageUrl:    String,
  sortOrder:   { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

export const Series = model('Series', seriesSchema);

const postRelationSchema = new Schema({
  postId:       { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  relationType: { type: String, required: true, maxlength: 30 },
  relationId:   { type: Schema.Types.ObjectId, required: true },
  relationRole: { type: String, maxlength: 50 },
  sortOrder:    { type: Number, default: 0 },
});

postRelationSchema.index({ postId: 1, relationType: 1, relationId: 1 }, { unique: true });

export const PostRelation = model('PostRelation', postRelationSchema);
