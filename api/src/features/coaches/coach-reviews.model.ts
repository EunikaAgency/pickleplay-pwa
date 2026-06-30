import { Schema, model } from 'mongoose';

const coachReviewSchema = new Schema({
  coachId: { type: Schema.Types.ObjectId, ref: 'Coach', required: true },
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating:  { type: Number, required: true },
  text:    String,
  status:  { type: String, default: 'pending_moderation' },
}, { timestamps: true });

coachReviewSchema.index({ coachId: 1, createdAt: -1 });

export const CoachReview = model('CoachReview', coachReviewSchema);
