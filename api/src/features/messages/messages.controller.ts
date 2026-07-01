import { z } from 'zod';
import { Conversation, Message, conversationKey } from './messages.model.js';
import { User } from '../auth/auth.model.js';
import { Venue } from '../venues/venues.model.js';
import { Notification } from '../interactions/interactions.model.js';
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

  const data = await Promise.all(
    convs.map(async (cv: any) => {
      const otherId = otherParticipantId(cv, user.sub);
      const since = new Date(readAtMs(cv, user.sub));
      const unread = await Message.countDocuments({
        conversationId: cv._id,
        senderId: { $ne: user.sub },
        createdAt: { $gt: since },
      });
      return {
        id: String(cv._id),
        otherParticipant: personView(otherId ? userById.get(otherId) : null) ?? (otherId ? { id: otherId, displayName: 'Player', avatarUrl: null } : null),
        lastBody: cv.lastBody ?? null,
        lastSenderId: cv.lastSenderId ? String(cv.lastSenderId) : null,
        lastAt: cv.lastAt ?? null,
        unread,
        contextType: cv.contextType ?? null,
        contextId: cv.contextId ? String(cv.contextId) : null,
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
      await conv.save();

      // Notify the recipient about this first message.
      const me = await User.findById(user.sub).select('displayName').lean();
      const senderName = (me as any)?.displayName || 'Someone';
      publishUserEvent(userId, 'message.created', {
        conversationId: String(conv._id),
        message: { id: String(msg._id), senderId: String(user.sub), body: introBody, createdAt: now, mine: false },
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
  conv.hiddenFor = [] as any;
  conv.reads = [
    ...(conv.reads ?? []).filter((r: any) => String(r.userId) !== user.sub),
    { userId: user.sub as any, at: now },
  ] as any;
  await conv.save();

  // Notify the recipient (in-app inbox + push + live unread badge).
  const recipientId = otherParticipantId(conv, user.sub);
  if (recipientId) {
    // Live-push the message itself to the recipient's open chat (realtime),
    // before the notification so an open thread updates instantly. `mine` is
    // false from the recipient's perspective.
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
    });

    const me = await User.findById(user.sub).select('displayName').lean();
    const senderName = (me as any)?.displayName || 'Someone';
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
  await msg.deleteOne();

  // If it was the thread's last message, refresh the preview from what remains.
  const latest = await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 }).lean();
  conv.lastBody = (latest as any)?.body ?? null;
  conv.lastSenderId = (latest as any)?.senderId ?? null;
  conv.lastAt = (latest as any)?.createdAt ?? null;
  await conv.save();

  // Tell the other participant so their open chat drops the message live.
  const otherId = otherParticipantId(conv, user.sub);
  if (otherId) publishUserEvent(otherId, 'message.deleted', { conversationId: String(conv._id), messageId: String(msgId) });

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

    const me = await User.findById(user.sub).select('displayName').lean();
    const senderName = (me as any)?.displayName || 'Someone';
    publishUserEvent(ownerId, 'message.created', {
      conversationId: String(conv._id),
      message: { id: String(msg._id), senderId: String(user.sub), body: introBody, createdAt: now, mine: false },
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
      count += await Message.countDocuments({ conversationId: cv._id, senderId: { $ne: user.sub }, createdAt: { $gt: since } });
    }),
  );
  return c.json({ data: { count } });
}
