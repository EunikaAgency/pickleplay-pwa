import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type CoachApplicationStatus = 'pending' | 'approved' | 'rejected' | 'removed';

// A coach's application to coach at a venue. `coachUserId` is the applying
// account (the actor); `coachId` snapshots their public Coach profile when one
// is linked, purely for display on the owner side. One row per coach+venue.
export interface ICoachApplication {
  _id: Types.ObjectId;
  coachUserId: Types.ObjectId;
  coachId?: Types.ObjectId;
  venueId: Types.ObjectId;
  status: CoachApplicationStatus;
  message?: string;
  decidedByUserId?: Types.ObjectId;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const coachApplicationSchema = new Schema({
  coachUserId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coachId:         { type: Schema.Types.ObjectId, ref: 'Coach' },
  venueId:         { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  status:          { type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending' },
  message:         { type: String, maxlength: 2000 },
  decidedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt:       Date,
}, { timestamps: true });

// One application per coach per venue — prevents duplicate submissions.
coachApplicationSchema.index({ coachUserId: 1, venueId: 1 }, { unique: true });
// Owner-side lookups: applications for a venue, optionally by status.
coachApplicationSchema.index({ venueId: 1, status: 1 });

export const CoachApplication = model('CoachApplication', coachApplicationSchema);
