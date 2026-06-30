import { Schema, model } from 'mongoose';

const reviewSchema = new Schema({
  venueId:     { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating:      { type: Number, required: true },
  text:        String,
  visitDate:   String,
  status:      { type: String, default: 'pending_moderation' },
  source:      { type: String, default: 'native' },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: Date,
  tags:        [{ tagId: { type: Schema.Types.ObjectId, ref: 'Tag' }, sentiment: { type: String, maxlength: 10 } }],
}, { timestamps: true });

reviewSchema.index({ venueId: 1, createdAt: -1 });

export const Review = model('Review', reviewSchema);

const reviewReplySchema = new Schema({
  reviewId:      { type: Schema.Types.ObjectId, ref: 'Review', required: true, unique: true },
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  replierUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text:          { type: String, required: true },
}, { timestamps: true });

export const ReviewReply = model('ReviewReply', reviewReplySchema);

const reviewReportSchema = new Schema({
  reviewId:       { type: Schema.Types.ObjectId, ref: 'Review', required: true },
  reporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason:         { type: String, maxlength: 30 },
  details:        String,
  status:         { type: String, default: 'pending' },
  resolvedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const ReviewReport = model('ReviewReport', reviewReportSchema);

const favoriteSchema = new Schema({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  favoritableType: { type: String, required: true, maxlength: 20 },
  favoritableId:   { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });

favoriteSchema.index({ userId: 1, favoritableType: 1, favoritableId: 1 }, { unique: true });

export const Favorite = model('Favorite', favoriteSchema);

const notificationSchema = new Schema({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, maxlength: 30 },
  title:   { type: String, required: true, maxlength: 200 },
  body:    { type: String, required: true },
  icon:    { type: String, maxlength: 50 },
  linkUrl: String,
  isRead:  { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);
