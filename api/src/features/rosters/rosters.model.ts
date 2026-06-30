import { Schema, model } from 'mongoose';

// A saved, reusable list of players owned by an organizer ("Regulars",
// "Advanced 4.0+", …) so they don't re-enter the same crowd every event.
// Members may be platform users (userId set) or plain contacts (name/email).
const rosterMemberSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },   // optional — non-platform players allowed
  name:   { type: String, required: true, maxlength: 120 },
  email:  { type: String, maxlength: 255 },
}, { _id: true });

const organizerRosterSchema = new Schema({
  organizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name:            { type: String, required: true, maxlength: 120 },
  description:     { type: String, maxlength: 500 },
  members:         { type: [rosterMemberSchema], default: [] },
}, { timestamps: true });

organizerRosterSchema.index({ organizerUserId: 1, createdAt: -1 });

export const OrganizerRoster = model('OrganizerRoster', organizerRosterSchema);
