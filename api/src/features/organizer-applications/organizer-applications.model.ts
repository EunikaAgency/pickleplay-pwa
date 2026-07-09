import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type OrganizerApplicationStatus = 'pending' | 'approved' | 'rejected' | 'removed';

// A player's application to organise tournaments/events at a venue. Mirrors the
// coach-applications model: one row per applicant+venue. The `organizerUserId` is
// the applying account; there's no separate Organizer profile collection (the
// organiser "identity" is just the User + the granted UserRole).
export interface IOrganizerApplication {
  _id: Types.ObjectId;
  organizerUserId: Types.ObjectId;
  venueId: Types.ObjectId;
  status: OrganizerApplicationStatus;
  message?: string;
  decidedByUserId?: Types.ObjectId;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const organizerApplicationSchema = new Schema({
  organizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  venueId:         { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  status:          { type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending' },
  message:         { type: String, maxlength: 2000 },
  decidedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt:       Date,
}, { timestamps: true });

// One application per organiser per venue — prevents duplicate submissions.
organizerApplicationSchema.index({ organizerUserId: 1, venueId: 1 }, { unique: true });
// Owner-side lookups: applications for a venue, optionally by status.
organizerApplicationSchema.index({ venueId: 1, status: 1 });

export const OrganizerApplication = model('OrganizerApplication', organizerApplicationSchema);
