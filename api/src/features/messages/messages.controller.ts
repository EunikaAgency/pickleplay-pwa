import { z } from 'zod';
import { Conversation, Message, conversationKey } from './messages.model.js';
import { User } from '../auth/auth.model.js';
import { Venue } from '../venues/venues.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { Notification } from '../interactions/interactions.model.js';
import { Media } from '../media/media.model.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const startSchema = z.object({
  userId: objectId,
  contextType: z.string().max(30).optional(),
  contextId: z.string().optional(),
});
const sendSchema = z.object({ body: z.string().min(1).max(4000), replyToMessageId: z.string().nullable().optional() });

const SEND_PERM = 'user.messages.send';

/** Public shape for a participant. */
function personView(u: any) {
  return u
    ? {
        id: String(u._id ?? u.id),
        displayName: u.displayName ?? 'Player',
        avatarUrl: u.avatarUrl ?? null,
        lastActiveAt: u.lastActiveAt ?? null,
      }
    : null;
}

/** The id of the conversation participant who isn't `me`. */
function otherParticipantId(conv: any, me: string): string | null {
  const ids = (conv.participantIds ?? []).map((p: any) => String(p));
  return ids.find((id: string) => id !== me) ?? null;
}

/** When `me` last read `conv` (epoch ms); 0 if never. */
function readAtMs(conv: any, me: string): number {
  const r = (conv.reads ?? []).find((x: any) => String(x.userId) === me);
  return r?.at ? new Date(r.at).getTime() : 0;
}

// GET /messages/conversations — the current user's threads, newest first, each
// with the other participant + last-message preview + unread count.
export async function listConversations(c: any) {
  const user = c.get('user');
  const convs = await Conversation.find({ participantIds: user.sub, hiddenFor: { $ne: user.sub } }).sort({ lastAt: -1, updatedAt: -1 }).limit(50).lean();
  if (!convs.length) return c.json({ data: [] });

  const otherIds = [...new Set(convs.map((cv: any) => otherParticipantId(cv, user.sub)).filter(Boolean))] as string[];
  const users = otherIds.length ? await User.find({ _id: { $in: otherIds } }).select('displayName avatarUrl lastActiveAt').lean() : [];
  const userById = new Map((users as any[]).map((u) => [String(u._id), u]));

  // Resolve context labels — venue names + booking info — in one batch pass so
  // each conversation row can show where it came from.
  const venueIds = convs.filter((cv: any) => cv.contextType === 'venue' && cv.contextId).map((cv: any) => String(cv.contextId));
  const bookingIds = convs.filter((cv: any) => cv.contextType === 'booking' && cv.contextId).map((cv: any) => String(cv.contextId));
  const [venues, bookings, venueMedia] = await Promise.all([
    venueIds.length ? Venue.find({ _id: { $in: venueIds } }).select('displayName mainImageUrl ownerUserId').lean() : [],
    bookingIds.length ? Booking.find({ _id: { $in: bookingIds } }).select('date venueId').lean() : [],
    venueIds.length ? Media.find({ ownerType: 'venue', ownerId: { $in: venueIds } }).select('ownerId url isPrimary').lean() : [],
  ]) as [any[], any[], any[]];
  const venueById = new Map(venues.map((v) => [String(v._id), v]));
  // Map venueId → best image URL. Start with mainImageUrl (CSV import, may be a
  // relative path like /images/venues/<slug>/...), then override with Media images
  // (user-uploaded, higher priority — prefer primary, then first found).
  const venueImageById = new Map<string, string>();
  for (const v of venues) {
    if ((v as any).mainImageUrl) venueImageById.set(String(v._id), (v as any).mainImageUrl);
  }
  for (const m of venueMedia) {
    const vid = String((m as any).ownerId);
    if (!venueImageById.has(vid) || (m as any).isPrimary) {
      venueImageById.set(vid, (m as any).url);
    }
  }
  const bookingById = new Map(bookings.map((b) => [String(b._id), b]));
  // Resolve booking venue names from the already-fetched venues + any additional ones.
  const bookingVenueIds = [...new Set(bookings.map((b: any) => String(b.venueId)).filter(Boolean))] as string[];
  const missingVenueIds = bookingVenueIds.filter((id) => !venueById.has(id));
  const extraVenues = missingVenueIds.length ? await Venue.find({ _id: { $in: missingVenueIds } }).select('displayName').lean() : [];
  for (const v of extraVenues as any[]) venueById.set(String(v._id), v);

  function contextLabel(cv: any): string | null {
    if (!cv.contextType || !cv.contextId) return null;
    const cid = String(cv.contextId);
    if (cv.contextType === 'venue') {
      const v = venueById.get(cid);
      return v?.displayName ?? null;
    }
    if (cv.contextType === 'booking') {
      const bk = bookingById.get(cid);
      if (!bk) return null;
      const v = venueById.get(String(bk.venueId));
      const venueName = v?.displayName ?? null;
      const d = bk.date ? new Date(bk.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
      if (venueName && d) return `${venueName} · ${d}`;
      if (venueName) return venueName;
      if (d) return d;
      return null;
    }
    return null;
  }

  const data = await Promise.all(
    convs.map(async (cv: any) => {
      const otherId = otherParticipantId(cv, user.sub);
      const since = new Date(readAtMs(cv, user.sub));
      const unread = await Message.countDocuments({
        conversationId: cv._id,
        senderId: { $ne: user.sub },
        deleted: { $ne: true },
        createdAt: { $gt: since },
      });
      return {
        id: String(cv._id),
        otherParticipant: personView(otherId ? userById.get(otherId) : null) ?? (otherId ? { id: otherId, displayName: 'Player', avatarUrl: null } : null),
        lastBody: cv.lastBody ?? null,
        lastSenderId: cv.lastSenderId ? String(cv.lastSenderId) : null,
        lastDeletedBy: cv.lastDeletedBy ? String(cv.lastDeletedBy) : null,
        lastAt: cv.lastAt ?? null,
        unread,
        contextType: cv.contextType ?? null,
        contextId: cv.contextId ? String(cv.contextId) : null,
        contextLabel: contextLabel(cv),
        contextImageUrl: cv.contextType === 'venue' && cv.contextId ? (venueImageById.get(String(cv.contextId)) ?? null) : null,
        /** True when the current user owns this venue — the owner should see the
         *  player's name + avatar, not the venue's. Players see the venue. */
        viewerIsOwner: cv.contextType === 'venue' && cv.contextId
          ? String((venueById.get(String(cv.contextId)) as any)?.ownerUserId) === user.sub
          : false,
      };
    }),
  );
  return c.json({ data });
}

// POST /messages/conversations — find-or-create a 1:1 thread with { userId }.
// Optionally scoped to a context ('venue' + contextId) so the "Message venue"
// button always lands on the same thread, and the list can show venue labels.
export async function startConversation(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, SEND_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messaging permission required' } }, 403);
  }
  const { userId, contextType, contextId } = startSchema.parse(await c.req.json());
  if (userId === user.sub) {
    return c.json({ error: { code: 'CONFLICT', message: "You can't message yourself" } }, 409);
  }
  const other = await User.findById(userId).select('displayName avatarUrl lastActiveAt').lean();
  if (!other) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // For venue-scoped conversations, the key includes the context so each
  // player↔owner pair gets one thread per venue (not one thread total).
  const baseKey = conversationKey(user.sub, userId);
  const effectiveKey = contextType && contextId ? `${baseKey}:${contextType}:${contextId}` : baseKey;

  let conv = await Conversation.findOne({ key: effectiveKey });
  let created = false;
  if (!conv) {
    conv = await Conversation.create({
      participantIds: [user.sub, userId],
      key: effectiveKey,
      reads: [{ userId: user.sub, at: new Date() }],
      contextType: contextType ?? undefined,
      contextId: contextId ?? undefined,
    });
    created = true;

    // For venue-scoped conversations, send an auto intro message so the owner
    // sees context immediately ("Hi, I have a question about The Dink Lab").
    if (contextType === 'venue' && contextId) {
      const venue = await Venue.findById(contextId).select('displayName').lean();
      const venueName = (venue as any)?.displayName || 'your venue';
      const introBody = `Hi, I have a question about ${venueName}.`;
      const now = new Date();
      const msg = await Message.create({ conversationId: conv._id, senderId: user.sub, body: introBody });
      conv.lastBody = introBody;
      conv.lastSenderId = user.sub as any;
      conv.lastAt = now;
      conv.lastDeletedBy = null;
      await conv.save();

      // Notify the recipient about this first message.
      const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
      const senderName = (me as any)?.displayName || 'Someone';
      const senderAvatar = (me as any)?.avatarUrl ?? null;
      publishUserEvent(userId, 'message.created', {
        conversationId: String(conv._id),
        message: { id: String(msg._id), senderId: String(user.sub), body: introBody, createdAt: now, mine: false },
        conversation: {
          lastBody: introBody,
          lastSenderId: String(user.sub),
          lastAt: now,
          lastDeletedBy: null,
          otherParticipant: { id: String(user.sub), displayName: senderName, avatarUrl: senderAvatar },
          contextType: 'venue',
          contextId: contextId,
          unread: 1,
        },
      });
      await notifyUser(userId, {
        type: 'message',
        title: `${senderName} · ${venueName}`,
        body: introBody,
        icon: 'chat',
        linkUrl: `/messages/${String(conv._id)}`,
        tag: `message-${String(conv._id)}`,
      });
    }
  }
  return c.json({ data: { id: String(conv._id), otherParticipant: personView(other) } }, created ? 201 : 200);
}

// GET /messages/conversations/:id — the thread's messages (oldest→newest) +
// the other participant. Marks the thread read for the current user.
export async function getConversation(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  const otherId = otherParticipantId(conv, user.sub);
  const other = otherId ? await User.findById(otherId).select('displayName avatarUrl lastActiveAt').lean() : null;
  const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(200).lean();

  // Mark this thread read for the current user (upsert their read timestamp).
  // Use the later of now and the newest loaded message's createdAt so that even
  // future-dated seed messages are captured as "read" on the next unread tally.
  const now = new Date();
  const newestMsg = messages.length ? new Date(messages[messages.length - 1].createdAt).getTime() : 0;
  const readAt = newestMsg > now.getTime() ? new Date(newestMsg) : now;
  conv.reads = [
    ...(conv.reads ?? []).filter((r: any) => String(r.userId) !== user.sub),
    { userId: user.sub, at: readAt },
  ] as any;
  await conv.save();

  // Also mark the related in-app notifications as read — the user has seen the
  // messages, so the badge should drop. Message notifications carry a linkUrl of
  // `/messages/:conversationId` (set by notifyUser in sendMessage / startConversation).
  await Notification.updateMany(
    { userId: user.sub, type: 'message', linkUrl: `/messages/${id}`, isRead: false },
    { $set: { isRead: true } },
  );

  if (otherId) {
    publishUserEvent(otherId, 'message.read', {
      conversationId: String(conv._id),
      readerId: user.sub,
      readAt: now,
    });
  }

  // Collect replyToMessageIds and fetch the referenced messages + their senders.
  const replyIds = [...new Set(messages.map((m: any) => m.replyToMessageId?.toString()).filter(Boolean))] as string[];
  const replyMessages = replyIds.length ? await Message.find({ _id: { $in: replyIds } }).select('senderId body createdAt').lean() : [];
  const replySenderIds = [...new Set(replyMessages.map((rm: any) => String(rm.senderId)))] as string[];
  const replySenders = replySenderIds.length ? await User.find({ _id: { $in: replySenderIds } }).select('displayName').lean() : [];
  const replySenderById = new Map((replySenders as any[]).map((u) => [String(u._id), u]));
  const replyById = new Map(replyMessages.map((rm: any) => {
    const sender = replySenderById.get(String(rm.senderId));
    return [String(rm._id), {
      id: String(rm._id),
      senderId: String(rm.senderId),
      senderName: (sender as any)?.displayName ?? 'Player',
      body: rm.body,
      createdAt: rm.createdAt,
    }];
  }));

  return c.json({
    data: {
      id: String(conv._id),
      otherParticipant: personView(other) ?? (otherId ? { id: otherId, displayName: 'Player', avatarUrl: null } : null),
      contextType: conv.contextType ?? null,
      contextId: conv.contextId ? String(conv.contextId) : null,
      messages: messages.map((m: any) => {
        const mine = String(m.senderId) === user.sub;
        const otherReadAt = otherId ? readAtMs(conv, otherId) : 0;
        const messageCreatedAt = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        const readByOther = mine && otherReadAt > 0 && messageCreatedAt > 0 && messageCreatedAt <= otherReadAt;
        return {
          id: String(m._id),
          senderId: String(m.senderId),
          body: m.body,
          createdAt: m.createdAt,
          mine,
          deleted: m.deleted === true,
          replyToMessageId: m.replyToMessageId ? String(m.replyToMessageId) : null,
          replyTo: m.replyToMessageId ? (replyById.get(String(m.replyToMessageId)) ?? null) : null,
          readByOther,
          readAtByOther: readByOther && otherReadAt ? new Date(otherReadAt) : null,
        };
      }),
    },
  });
}

// POST /messages/conversations/:id/messages — send a message in a thread.
export async function sendMessage(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, SEND_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messaging permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  const { body, replyToMessageId } = sendSchema.parse(await c.req.json());
  const now = new Date();
  const msg = await Message.create({
    conversationId: conv._id,
    senderId: user.sub,
    body,
    replyToMessageId: replyToMessageId || undefined,
  });

  // Populate the replied-to message for the response.
  let replyTo: any = null;
  if (replyToMessageId && objectId.safeParse(replyToMessageId).success) {
    const replied = await Message.findById(replyToMessageId).select('senderId body createdAt').lean();
    if (replied) {
      const repliedSender = await User.findById((replied as any).senderId).select('displayName').lean();
      replyTo = {
        id: String((replied as any)._id),
        senderId: String((replied as any).senderId),
        senderName: (repliedSender as any)?.displayName || 'Player',
        body: (replied as any).body,
        createdAt: (replied as any).createdAt,
      };
    }
  }

  // Update the thread preview + mark it read for the sender. New activity also
  // un-hides the thread for anyone who'd soft-deleted it (it reappears).
  conv.lastBody = body;
  conv.lastSenderId = user.sub as any;
  conv.lastAt = now;
  conv.lastDeletedBy = null;
  conv.hiddenFor = [] as any;
  conv.reads = [
    ...(conv.reads ?? []).filter((r: any) => String(r.userId) !== user.sub),
    { userId: user.sub as any, at: now },
  ] as any;
  await conv.save();

  // Notify the recipient (in-app inbox + push + live unread badge).
  const recipientId = otherParticipantId(conv, user.sub);
  if (recipientId) {
    const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
    const senderName = (me as any)?.displayName || 'Someone';
    const senderAvatar = (me as any)?.avatarUrl ?? null;

    // Live-push the message itself to the recipient's open chat (realtime),
    // before the notification so an open thread updates instantly. `mine` is
    // false from the recipient's perspective. Also include enough conversation-
    // summary data so the conversation list can surgically upsert without a
    // full re-fetch (lastBody, lastAt, otherParticipant, context).
    publishUserEvent(recipientId, 'message.created', {
      conversationId: String(conv._id),
      message: {
        id: String(msg._id),
        senderId: String(user.sub),
        body,
        createdAt: now,
        mine: false,
        replyToMessageId: replyToMessageId || null,
        replyTo,
      },
      // Conversation-summary fields for the recipient's conversation list so
      // it can insert/update the row without re-fetching the full list.
      conversation: {
        lastBody: body,
        lastSenderId: String(user.sub),
        lastAt: now,
        lastDeletedBy: null,
        otherParticipant: {
          id: String(user.sub),
          displayName: senderName,
          avatarUrl: senderAvatar,
        },
        contextType: conv.contextType ?? null,
        contextId: conv.contextId ? String(conv.contextId) : null,
        // Unread count from the recipient's perspective: the recipient hasn't
        // read this yet, so it's at least 1 (the client adds it to any existing
        // unread count for the thread).
        unread: 1,
      },
    });
    const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    await notifyUser(recipientId, {
      type: 'message',
      title: senderName,
      body: preview,
      icon: 'chat',
      linkUrl: `/messages/${String(conv._id)}`,
      tag: `message-${String(conv._id)}`,
    });
  }

  return c.json({
    data: {
      id: String(msg._id),
      senderId: user.sub,
      body,
      createdAt: now,
      mine: true,
      replyToMessageId: replyToMessageId || null,
      replyTo,
      readByOther: false,
      readAtByOther: null,
    },
  }, 201);
}

// POST /messages/conversations/:id/read — mark this thread read without
// reloading all messages. Used when a new message arrives while the thread is open.
export async function markConversationRead(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const now = new Date();
  conv.reads = [
    ...(conv.reads ?? []).filter((r: any) => String(r.userId) !== user.sub),
    { userId: user.sub, at: now },
  ] as any;
  await conv.save();

  // Also mark the related in-app notifications as read (same rationale as getConversation).
  await Notification.updateMany(
    { userId: user.sub, type: 'message', linkUrl: `/messages/${id}`, isRead: false },
    { $set: { isRead: true } },
  );

  const otherId = otherParticipantId(conv, user.sub);
  if (otherId) {
    publishUserEvent(otherId, 'message.read', {
      conversationId: String(conv._id),
      readerId: user.sub,
      readAt: now,
    });
  }

  return c.json({ data: { readAt: now } });
}

// POST /messages/conversations/:id/typing — broadcast a typing indicator to the
// other participant via SSE. Lightweight, no persistence; the client debounces
// calls so we don't firehose the stream on every keystroke.
export async function sendTyping(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  const otherId = otherParticipantId(conv, user.sub);
  if (otherId) {
    publishUserEvent(otherId, 'message.typing', {
      conversationId: String(conv._id),
      userId: user.sub,
    });
  }
  return c.json({ data: { ok: true } });
}

// DELETE /messages/conversations/:id — soft-delete the thread for the current
// user only (hide from their list). The other participant keeps it; a new
// message un-hides it for everyone.
export async function deleteConversation(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  conv.hiddenFor = [
    ...((conv.hiddenFor ?? []) as any[]).filter((u: any) => String(u) !== user.sub),
    user.sub,
  ] as any;
  await conv.save();
  return c.json({ data: { ok: true } });
}

// DELETE /messages/conversations/:id/messages/:msgId — delete a single message.
// Only the sender may delete their own message; it's removed for both sides
// (the recipient gets a realtime `message.deleted` so an open chat updates).
export async function deleteMessage(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const msgId = c.req.param('msgId');
  if (!objectId.safeParse(id).success || !objectId.safeParse(msgId).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }
  const conv = await Conversation.findById(id);
  if (!conv || !(conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  const msg = await Message.findOne({ _id: msgId, conversationId: conv._id });
  if (!msg) return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  if (String((msg as any).senderId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' } }, 403);
  }
  // Soft-delete so the "deleted" placeholder survives page refresh.
  (msg as any).deleted = true;
  await msg.save();

  // Was this the chronologically last message? Compare against the latest
  // non-deleted message (if any). If the deleted message was last, mark
  // lastDeletedBy so the conversation list shows "You deleted a message" /
  // "Name deleted a message". Otherwise, show the actual latest message.
  const deletedAt = (msg as any).createdAt;
  const latest = await Message.findOne({ conversationId: conv._id, deleted: { $ne: true } }).sort({ createdAt: -1 }).lean();
  if (!latest || new Date(deletedAt).getTime() >= new Date((latest as any).createdAt).getTime()) {
    // The deleted message was the last one (or the only one).
    conv.lastDeletedBy = (msg as any).senderId;
    if (latest) {
      conv.lastBody = (latest as any).body;
      conv.lastSenderId = (latest as any).senderId;
      conv.lastAt = (latest as any).createdAt;
    }
  } else {
    // The deleted message was older — use the actual latest message.
    conv.lastBody = (latest as any).body;
    conv.lastSenderId = (latest as any).senderId;
    conv.lastAt = (latest as any).createdAt;
    conv.lastDeletedBy = null;
  }
  await conv.save();

  // Tell BOTH participants so their open chat + conversation list update live.
  // Include the updated conversation preview so the list can surgically update
  // without a full re-fetch.
  const otherId = otherParticipantId(conv, user.sub);
  const deletedBy = String((msg as any).senderId);
  const convPreview = {
    lastBody: conv.lastBody ?? null,
    lastSenderId: conv.lastSenderId ? String(conv.lastSenderId) : null,
    lastAt: conv.lastAt ?? null,
    lastDeletedBy: conv.lastDeletedBy ? String(conv.lastDeletedBy) : null,
    deletedBy: deletedBy !== user.sub ? deletedBy : user.sub,
  };
  const payload = { conversationId: String(conv._id), messageId: String(msgId), conversation: convPreview };
  publishUserEvent(user.sub, 'message.deleted', payload);
  if (otherId) publishUserEvent(otherId, 'message.deleted', payload);

  return c.json({ data: { ok: true } });
}

// GET /messages/venue/:venueId — find-or-create the venue-scoped conversation
// between the current user and the venue owner. The "Message venue" button always
// lands on the same thread so the player's inquiry history stays in one place.
export async function getVenueConversation(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, SEND_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messaging permission required' } }, 403);
  }
  const venueId = c.req.param('venueId');
  if (!objectId.safeParse(venueId).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  }
  const venue = await Venue.findById(venueId).select('displayName ownerUserId').lean();
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const ownerId = (venue as any).ownerUserId?.toString();
  if (!ownerId) {
    return c.json({ error: { code: 'CONFLICT', message: 'This venue has no owner to message yet' } }, 409);
  }
  if (ownerId === user.sub) {
    return c.json({ error: { code: 'CONFLICT', message: "You can't message your own venue" } }, 409);
  }

  // Find-or-create a venue-scoped conversation.
  const baseKey = conversationKey(user.sub, ownerId);
  const effectiveKey = `${baseKey}:venue:${venueId}`;

  let conv = await Conversation.findOne({ key: effectiveKey });
  let created = false;
  if (!conv) {
    conv = await Conversation.create({
      participantIds: [user.sub, ownerId],
      key: effectiveKey,
      reads: [{ userId: user.sub, at: new Date() }],
      contextType: 'venue',
      contextId: venueId,
    });
    created = true;

    // Auto intro message so the owner sees venue context immediately.
    const venueName = (venue as any).displayName || 'your venue';
    const introBody = `Hi, I have a question about ${venueName}.`;
    const now = new Date();
    const msg = await Message.create({ conversationId: conv._id, senderId: user.sub, body: introBody });
    conv.lastBody = introBody;
    conv.lastSenderId = user.sub as any;
    conv.lastAt = now;
    await conv.save();

    const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
    const senderName = (me as any)?.displayName || 'Someone';
    const senderAvatar = (me as any)?.avatarUrl ?? null;
    publishUserEvent(ownerId, 'message.created', {
      conversationId: String(conv._id),
      message: { id: String(msg._id), senderId: String(user.sub), body: introBody, createdAt: now, mine: false },
      conversation: {
        lastBody: introBody,
        lastSenderId: String(user.sub),
        lastAt: now,
        lastDeletedBy: null,
        otherParticipant: { id: String(user.sub), displayName: senderName, avatarUrl: senderAvatar },
        contextType: 'venue',
        contextId: venueId,
        unread: 1,
      },
    });
    await notifyUser(ownerId, {
      type: 'message',
      title: `${senderName} · ${venueName}`,
      body: introBody,
      icon: 'chat',
      linkUrl: `/messages/${String(conv._id)}`,
      tag: `message-${String(conv._id)}`,
    });
  }

  // Resolve the venue name for the response header.
  const venueName = (venue as any).displayName || null;
  return c.json({
    data: {
      id: String(conv._id),
      otherParticipant: null, // resolved on the client from the conversation load
      contextType: 'venue',
      contextId: venueId,
      contextLabel: venueName,
    },
  }, created ? 201 : 200);
}

// GET /messages/unread-count — total unread messages across the user's threads.
export async function unreadMessageCount(c: any) {
  const user = c.get('user');
  const convs = await Conversation.find({ participantIds: user.sub, hiddenFor: { $ne: user.sub } }).select('reads').lean();
  let count = 0;
  await Promise.all(
    convs.map(async (cv: any) => {
      const since = new Date(readAtMs(cv, user.sub));
      count += await Message.countDocuments({ conversationId: cv._id, senderId: { $ne: user.sub }, deleted: { $ne: true }, createdAt: { $gt: since } });
    }),
  );
  return c.json({ data: { count } });
}
