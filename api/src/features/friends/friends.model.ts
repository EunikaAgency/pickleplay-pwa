import { Schema, model } from 'mongoose';

/**
 * A friendship between two users. The requester sends a request; the recipient
 * accepts or rejects. Only users with role player/coach/organizer can be added
 * as friends (enforced in the controller, not the schema).
 *
 * The pair is stored once (requester ↔ recipient), with `status` tracking the
 * lifecycle: pending → accepted | rejected. Removing a friend deletes the row.
 */
const friendSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
);

// One row per unordered pair — prevents duplicate requests.
friendSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
// Look up all of a user's friendships (either side).
friendSchema.index({ requesterId: 1, status: 1 });
friendSchema.index({ recipientId: 1, status: 1 });

export const Friend = model('Friend', friendSchema);
