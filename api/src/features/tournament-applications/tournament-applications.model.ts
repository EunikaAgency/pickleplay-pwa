import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type TournamentApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// An organizer's request to host a tournament at a venue on a given schedule.
// The venue owner reviews and approves/rejects it (mirrors CoachApplication).
// `organizerUserId` is the applying account (the actor); `tournamentId` links
// the draft tournament the request is for. History is preserved — a tournament
// may have several requests over time (e.g. rejected at venue A, re-requested
// at venue B), so this is intentionally not a 1:1 with the tournament.
export interface ITournamentApplication {
  _id: Types.ObjectId;
  tournamentId: Types.ObjectId;
  organizerUserId: Types.ObjectId;
  venueId: Types.ObjectId;
  requestedStartDate: string;
  requestedEndDate?: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  courtsRequired: number;
  message?: string;
  status: TournamentApplicationStatus;
  remarks?: string;
  decidedByUserId?: Types.ObjectId;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentApplicationSchema = new Schema({
  tournamentId:       { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  organizerUserId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  venueId:            { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  requestedStartDate: { type: String, required: true },
  requestedEndDate:   String,
  timeSlotStart:      { type: String, required: true },
  timeSlotEnd:        { type: String, required: true },
  courtsRequired:     { type: Number, required: true },
  message:            { type: String, maxlength: 2000 },
  status:             { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  remarks:            { type: String, maxlength: 2000 },
  decidedByUserId:    { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt:          Date,
}, { timestamps: true });

// Owner-side lookups: requests for a venue, optionally by status.
tournamentApplicationSchema.index({ venueId: 1, status: 1 });
// Organizer's requests, newest first.
tournamentApplicationSchema.index({ organizerUserId: 1, createdAt: -1 });
// At most one *live* (pending) request per tournament+venue — re-requests after
// a decision are still allowed (partial filter keeps history open).
tournamentApplicationSchema.index(
  { tournamentId: 1, venueId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const TournamentApplication = model('TournamentApplication', tournamentApplicationSchema);
