import { Schema, model } from 'mongoose';

// Direct 1:1 messaging between two users (e.g. a player ↔ a game organizer).
// A Conversation is the durable thread; Messages hang off it. The thread is
// uniquely identified by `key` — the two participant ids sorted + joined — so
// "start a conversation with X" is idempotent (find-or-create on the pair).
//
// Unread is tracked per participant via `reads` (their last-read timestamp): a
// participant's unread = messages from the *other* side newer than their read
// mark. Each new message also fires a `message` Notification via shared/lib/
// notify.ts, so arrivals already surface in the notification inbox + push +
// the live unread badge — this collection backs the dedicated chat UI.
const conversationSchema = new Schema(
  {
    // Exactly two participants for now (1:1). Kept as an array so a group
    // thread could reuse the shape later.
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    // Sorted "idA:idB" — unique per unordered pair (find-or-create key).
    key: { type: String, required: true, unique: true },
    // Denormalized last-message preview for the conversation list.
    lastBody: { type: String, maxlength: 4000 },
    lastSenderId: { type: Schema.Types.ObjectId, ref: 'User' },
    lastAt: { type: Date },
    // Per-participant last-read timestamps, for unread counts.
    reads: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date },
      },
    ],
    // Per-user soft delete: a participant who "deletes" the thread is added here,
    // hiding it from THEIR list only (the other side keeps it). A new message
    // clears this so the thread reappears for everyone.
    hiddenFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Optional context: when a conversation is started from a venue page, this
    // links it back so the chat UI can show "Re: The Dink Lab" and the "Message
    // venue" button always lands on the same thread (find-or-create by key + context).
    contextType: { type: String, maxlength: 30 },   // 'venue' (extensible)
    contextId:   { type: Schema.Types.ObjectId },    // ObjectId of the context entity
  },
  { timestamps: true },
);

conversationSchema.index({ contextType: 1, contextId: 1, key: 1 });

conversationSchema.index({ participantIds: 1, lastAt: -1 });

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Conversation = model('Conversation', conversationSchema);
export const Message = model('Message', messageSchema);

/** Stable conversation key for an unordered pair of user ids. */
export function conversationKey(a: string, b: string): string {
  return [String(a), String(b)].sort().join(':');
}
