import { z } from 'zod';
import { Conversation, Message, conversationKey } from './messages.model.js';
import { User } from '../auth/auth.model.js';
import { Venue, VenueStaff } from '../venues/venues.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { Notification } from '../interactions/interactions.model.js';
import { Media } from '../media/media.model.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { hasPermission, effectiveOwnerId } from '../../shared/lib/permissions.js';

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

/**
 * ── Who works a venue ───────────────────────────────────────────────────────
 * A message to a venue is addressed to the BUSINESS, not to the owner as a
 * person — so the whole venue side sees it and any of them can reply. That side
 * is: the owner, the owner's staff sub-accounts (parentOwnerUserId, the same
 * lever effectiveOwnerId pulls everywhere else), and anyone holding an active
 * VenueStaff row for that venue.
 *
 * The owner's PERSONAL threads stay private: visibility is granted per venue
 * (contextId), never per participant — so a thread where the owner is merely a
 * participant (a plain DM, or their own inquiry to someone else's venue) is
 * invisible to their staff.
 */

/** Venue ids the viewer works: every venue their effective owner owns, plus any they staff. */
async function managedVenueIds(user: any): Promise<string[]> {
  const ids = new Set<string>();
  const ownerId = effectiveOwnerId(user);
  const [owned, staffed] = await Promise.all([
    ownerId ? Venue.find({ ownerUserId: ownerId }).select('_id').lean() : [],
    VenueStaff.find({ userId: user.sub, status: 'active' }).select('venueId').lean(),
  ]) as [any[], any[]];
  for (const v of owned) ids.add(String(v._id));
  for (const s of staffed) ids.add(String(s.venueId));
  return [...ids];
}

/** Everyone who works this venue — the recipients of a player's message to it. */
async function venueSideUserIds(venueId: string, ownerId: string | null): Promise<string[]> {
  const ids = new Set<string>();
  if (ownerId) ids.add(String(ownerId));
  const [subAccounts, staffed] = await Promise.all([
    ownerId ? User.find({ parentOwnerUserId: ownerId }).select('_id').lean() : [],
    VenueStaff.find({ venueId, status: 'active' }).select('userId').lean(),
  ]) as [any[], any[]];
  for (const u of subAccounts) ids.add(String(u._id));
  for (const s of staffed) ids.add(String(s.userId));
  return [...ids];
}

/**
 * Venue label/image + whether the viewer is on the venue side. A player messaging
 * a venue must see the VENUE (that's who they think they're talking to), not the
 * owner's personal name; the venue side sees the player.
 */
async function venueContext(conv: any, user: any): Promise<{
  label: string | null; imageUrl: string | null; ownerId: string | null; viewerIsVenueSide: boolean;
}> {
  const empty = { label: null, imageUrl: null, ownerId: null, viewerIsVenueSide: false };
  if (conv.contextType !== 'venue' || !conv.contextId) return empty;
  const venue: any = await Venue.findById(conv.contextId).select('displayName mainImageUrl ownerUserId').lean();
  if (!venue) return empty;
  // mainImageUrl (CSV import) is the base; user-uploaded Media wins — primary first.
  const media = await Media.find({ ownerType: 'venue', ownerId: String(conv.contextId) }).select('url isPrimary').lean();
  let imageUrl: string | null = venue.mainImageUrl ?? null;
  for (const m of media as any[]) {
    if (!imageUrl || m.isPrimary) imageUrl = m.url;
  }
  return {
    label: venue.displayName ?? null,
    imageUrl,
    ownerId: venue.ownerUserId ? String(venue.ownerUserId) : null,
    viewerIsVenueSide: (await managedVenueIds(user)).includes(String(conv.contextId)),
  };
}

/** Participants can always see a thread; a venue thread is also open to its staff. */
async function canAccess(conv: any, user: any): Promise<boolean> {
  if ((conv.participantIds ?? []).some((p: any) => String(p) === user.sub)) return true;
  if (conv.contextType !== 'venue' || !conv.contextId) return false;
  return (await managedVenueIds(user)).includes(String(conv.contextId));
}

/** The two sides of a thread: everyone who works the venue, and the customer. */
async function threadSides(conv: any): Promise<{ venueSide: string[]; playerId: string | null }> {
  if (conv.contextType !== 'venue' || !conv.contextId) return { venueSide: [], playerId: null };
  const venue: any = await Venue.findById(conv.contextId).select('ownerUserId').lean();
  const ownerId = venue?.ownerUserId ? String(venue.ownerUserId) : null;
  return {
    venueSide: await venueSideUserIds(String(conv.contextId), ownerId),
    playerId: playerParticipantId(conv, ownerId),
  };
}

/**
 * The other SIDE of the thread — the audience for a read receipt or a typing
 * indicator. A receipt must never cross within a side: a colleague opening the
 * venue inbox is not the customer seeing the reply.
 */
function otherSideOf(sides: { venueSide: string[]; playerId: string | null }, conv: any, me: string): string[] {
  const { venueSide, playerId } = sides;
  if (venueSide.length) {
    if (venueSide.includes(me)) return playerId && playerId !== me ? [playerId] : [];
    return venueSide;
  }
  const other = otherParticipantId(conv, me);
  return other ? [other] : [];
}

/** Everyone who can see the thread — both participants plus the venue's staff. */
async function threadViewerIds(conv: any): Promise<string[]> {
  const ids = new Set<string>((conv.participantIds ?? []).map((p: any) => String(p)));
  for (const uid of (await threadSides(conv)).venueSide) ids.add(uid);
  return [...ids];
}

/**
 * Mark the thread read for the viewer — and, on a venue thread, for the WHOLE
 * venue side. The inbox is shared, so once the owner or any staff member opens
 * it the enquiry is handled: the badge (and the message notification) must clear
 * for the rest of them, live, or they'd all keep chasing the same message.
 *
 * Two different signals go out, and conflating them would lie to someone:
 *   • `message.read` → the other SIDE: a genuine "Seen" receipt.
 *   • `conversation.read` → my own side: "a colleague has this" — it clears their
 *     badge but must NOT tick the venue's replies as seen by the customer.
 */
async function markThreadRead(conv: any, user: any, readAt: Date): Promise<void> {
  const me = String(user.sub);
  const sides = await threadSides(conv);
  const meOnVenueSide = sides.venueSide.includes(me);
  const readers = meOnVenueSide ? sides.venueSide : [me];

  conv.reads = [
    ...(conv.reads ?? []).filter((r: any) => !readers.includes(String(r.userId))),
    ...readers.map((uid) => ({ userId: uid, at: readAt })),
  ] as any;
  await conv.save();

  // The user has seen the messages, so the notification badge should drop too.
  // Message notifications carry a linkUrl of `/messages/:conversationId`.
  await Notification.updateMany(
    { userId: { $in: readers }, type: 'message', linkUrl: `/messages/${String(conv._id)}`, isRead: false },
    { $set: { isRead: true } },
  );

  const payload = { conversationId: String(conv._id), readerId: me, readAt };
  for (const uid of otherSideOf(sides, conv, me)) publishUserEvent(uid, 'message.read', payload);
  for (const uid of readers.filter((uid) => uid !== me)) publishUserEvent(uid, 'conversation.read', payload);
}

/** The player on a venue thread — the participant who isn't the venue's owner. */
function playerParticipantId(conv: any, ownerId: string | null): string | null {
  const ids = (conv.participantIds ?? []).map((p: any) => String(p));
  return ids.find((id: string) => id !== String(ownerId)) ?? ids[0] ?? null;
}

/**
 * Announce a player's opening message on a venue thread to everyone who works
 * that venue — not just the owner, or staff would never learn a customer wrote in.
 */
async function announceVenueIntro(opts: {
  conv: any; senderId: string; venueId: string; venueName: string; messageId: string; body: string; at: Date;
}): Promise<void> {
  const { conv, senderId, venueId, venueName, messageId, body, at } = opts;
  const venue: any = await Venue.findById(venueId).select('ownerUserId').lean();
  const side = await venueSideUserIds(venueId, venue?.ownerUserId ? String(venue.ownerUserId) : null);
  const recipients = side.filter((uid) => uid !== String(senderId));
  if (!recipients.length) return;

  const me: any = await User.findById(senderId).select('displayName avatarUrl').lean();
  const senderName = me?.displayName || 'Someone';
  const senderAvatar = me?.avatarUrl ?? null;

  for (const uid of recipients) {
    publishUserEvent(uid, 'message.created', {
      conversationId: String(conv._id),
      message: { id: messageId, senderId: String(senderId), senderName, body, createdAt: at, mine: false, fromVenueSide: false },
      conversation: {
        lastBody: body,
        lastSenderId: String(senderId),
        lastAt: at,
        lastDeletedBy: null,
        otherParticipant: { id: String(senderId), displayName: senderName, avatarUrl: senderAvatar },
        contextType: 'venue',
        contextId: venueId,
        unread: 1,
      },
    });
  }
  await Promise.all(recipients.map((uid) => notifyUser(uid, {
    type: 'message',
    title: `${senderName} · ${venueName}`,
    body,
    icon: 'chat',
    linkUrl: `/messages/${String(conv._id)}`,
    tag: `message-${String(conv._id)}`,
  })));
}

/** When `me` last read `conv` (epoch ms); 0 if never. */
function readAtMs(conv: any, me: string): number {
  const r = (conv.reads ?? []).find((x: any) => String(x.userId) === me);
  return r?.at ? new Date(r.at).getTime() : 0;
}

/**
 * When the far side last read the thread — drives the Seen receipt. The venue
 * side is a group (owner + staff), so for the player any of them reading counts;
 * for the venue side only the player's own read mark does (a colleague opening
 * the thread must not mark the message "Seen" by the customer).
 */
function otherSideReadAtMs(conv: any, me: string, playerId: string | null, viewerIsVenueSide: boolean): number {
  if (viewerIsVenueSide) return playerId ? readAtMs(conv, playerId) : 0;
  const times = (conv.reads ?? [])
    .filter((r: any) => String(r.userId) !== me)
    .map((r: any) => (r.at ? new Date(r.at).getTime() : 0));
  return times.length ? Math.max(...times) : 0;
}

// GET /messages/conversations — the current user's threads, newest first, each
// with the other participant + last-message preview + unread count.
export async function listConversations(c: any) {
  const user = c.get('user');
  // The viewer's own threads, plus every thread addressed to a venue they work —
  // staff share the venue's inbox. Personal threads are not shared: they match
  // only via participantIds.
  const worked = await managedVenueIds(user);
  const convs = await Conversation.find({
    $or: [
      { participantIds: user.sub },
      ...(worked.length ? [{ contextType: 'venue', contextId: { $in: worked } }] : []),
    ],
    hiddenFor: { $ne: user.sub },
  }).sort({ lastAt: -1, updatedAt: -1 }).limit(50).lean();
  if (!convs.length) return c.json({ data: [] });

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

  // Who the viewer is talking to. Staff aren't participants of the venue threads
  // they can see, so their counterpart is the PLAYER (the participant who isn't
  // the venue's owner) — never their own owner.
  const otherIdByConv = new Map<string, string | null>(convs.map((cv: any) => {
    const isParticipant = (cv.participantIds ?? []).some((p: any) => String(p) === user.sub);
    if (isParticipant) return [String(cv._id), otherParticipantId(cv, user.sub)];
    const ownerId = (venueById.get(String(cv.contextId)) as any)?.ownerUserId;
    return [String(cv._id), playerParticipantId(cv, ownerId ? String(ownerId) : null)];
  }));
  const otherIds = [...new Set([...otherIdByConv.values()].filter(Boolean))] as string[];
  const users = otherIds.length ? await User.find({ _id: { $in: otherIds } }).select('displayName avatarUrl lastActiveAt').lean() : [];
  const userById = new Map((users as any[]).map((u) => [String(u._id), u]));

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
      const otherId = otherIdByConv.get(String(cv._id)) ?? null;
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
        /** True when the viewer works this venue (owner or staff) — they should see
         *  the player's name + avatar, so they know WHO messaged. Players see the venue. */
        viewerIsVenueSide: cv.contextType === 'venue' && cv.contextId
          ? worked.includes(String(cv.contextId))
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

      // Tell the whole venue side — the owner AND their staff — a customer wrote in.
      await announceVenueIntro({
        conv, senderId: user.sub, venueId: contextId, venueName,
        messageId: String(msg._id), body: introBody, at: now,
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
  if (!conv || !(await canAccess(conv, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  // Venue-scoped thread: the player is talking to the VENUE, not to a stranger —
  // so they get the venue's name + image, while the venue side (owner + staff)
  // sees the player. Same model as listConversations.
  const ctx = await venueContext(conv, user);
  // Staff aren't participants, so their counterpart is the player, not the owner.
  const isParticipant = (conv.participantIds ?? []).some((p: any) => String(p) === user.sub);
  const otherId = isParticipant ? otherParticipantId(conv, user.sub) : playerParticipantId(conv, ctx.ownerId);
  const other = otherId ? await User.findById(otherId).select('displayName avatarUrl lastActiveAt').lean() : null;
  const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(200).lean();

  // Mark this thread read (for the whole venue side, if that's who's reading).
  // Use the later of now and the newest loaded message's createdAt so that even
  // future-dated seed messages are captured as "read" on the next unread tally.
  const now = new Date();
  const newestMsg = messages.length ? new Date(messages[messages.length - 1].createdAt).getTime() : 0;
  const readAt = newestMsg > now.getTime() ? new Date(newestMsg) : now;
  await markThreadRead(conv, user, readAt);

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

  // Name every sender — a venue inbox is shared, so staff must be able to tell
  // which colleague already answered (they all read as the venue to the player).
  const senderIds = [...new Set(messages.map((m: any) => String(m.senderId)))];
  const senders = senderIds.length ? await User.find({ _id: { $in: senderIds } }).select('displayName').lean() : [];
  const senderNameById = new Map((senders as any[]).map((u) => [String(u._id), u.displayName ?? 'Player']));

  // A venue thread has exactly one player; anyone else who posts in it speaks for
  // the venue (the owner, or a staff member replying on their behalf).
  const playerId = ctx.label ? playerParticipantId(conv, ctx.ownerId) : null;
  const otherReadAt = otherSideReadAtMs(conv, user.sub, playerId, ctx.viewerIsVenueSide);

  return c.json({
    data: {
      id: String(conv._id),
      otherParticipant: personView(other) ?? (otherId ? { id: otherId, displayName: 'Player', avatarUrl: null } : null),
      contextType: conv.contextType ?? null,
      contextId: conv.contextId ? String(conv.contextId) : null,
      contextLabel: ctx.label,
      contextImageUrl: ctx.imageUrl,
      viewerIsVenueSide: ctx.viewerIsVenueSide,
      messages: messages.map((m: any) => {
        const mine = String(m.senderId) === user.sub;
        const messageCreatedAt = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        const readByOther = mine && otherReadAt > 0 && messageCreatedAt > 0 && messageCreatedAt <= otherReadAt;
        return {
          id: String(m._id),
          senderId: String(m.senderId),
          senderName: senderNameById.get(String(m.senderId)) ?? 'Player',
          body: m.body,
          createdAt: m.createdAt,
          mine,
          /** Sent by the venue (owner or staff) — so staff see it as outgoing, not as the player. */
          fromVenueSide: playerId != null && String(m.senderId) !== playerId,
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
  if (!conv || !(await canAccess(conv, user))) {
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

  // Update the thread preview, then mark it read for the sender — and, if they're
  // venue side, for their colleagues too: answering IS handling it, so nobody else
  // should be left with a badge chasing a message that's already been dealt with.
  // New activity also un-hides the thread for anyone who'd soft-deleted it.
  conv.lastBody = body;
  conv.lastSenderId = user.sub as any;
  conv.lastAt = now;
  conv.lastDeletedBy = null;
  conv.hiddenFor = [] as any;
  await markThreadRead(conv, user, now);

  // ── Fan the message out ──────────────────────────────────────────────────
  // A venue thread is a shared inbox: it's seen by the player AND everyone who
  // works the venue. Everyone but the sender gets the realtime push (so open
  // chats and unread badges stay in sync), but a NOTIFICATION only crosses the
  // player↔venue line — a colleague answering a customer shouldn't ping the rest
  // of the staff as if it were new work.
  const ctx = await venueContext(conv, user);
  const venueSide = ctx.label && conv.contextId
    ? await venueSideUserIds(String(conv.contextId), ctx.ownerId)
    : [];
  const playerId = ctx.label ? playerParticipantId(conv, ctx.ownerId) : null;
  const senderIsVenueSide = venueSide.includes(String(user.sub));

  const viewers = ctx.label
    ? [...new Set([playerId, ...venueSide].filter(Boolean) as string[])]
    : (conv.participantIds ?? []).map((p: any) => String(p));
  const liveTo = viewers.filter((uid) => uid !== String(user.sub));
  const notifyTo = ctx.label
    ? (senderIsVenueSide ? (playerId ? [playerId] : []) : venueSide.filter((uid) => uid !== String(user.sub)))
    : liveTo;

  if (liveTo.length || notifyTo.length) {
    const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
    const senderName = (me as any)?.displayName || 'Someone';
    const senderAvatar = (me as any)?.avatarUrl ?? null;
    // The venue side's list rows are headed by the PLAYER (who messaged), not by
    // whichever colleague last replied.
    const player = playerId && playerId !== String(user.sub)
      ? await User.findById(playerId).select('displayName avatarUrl').lean()
      : null;

    const message = {
      id: String(msg._id),
      senderId: String(user.sub),
      senderName,
      body,
      createdAt: now,
      mine: false,
      fromVenueSide: senderIsVenueSide,
      replyToMessageId: replyToMessageId || null,
      replyTo,
    };

    // Live-push to every other viewer, before the notification so an open thread
    // updates instantly. The conversation summary rides along so their list can
    // upsert the row without re-fetching.
    for (const uid of liveTo) {
      const recipientIsVenueSide = venueSide.includes(uid);
      publishUserEvent(uid, 'message.created', {
        conversationId: String(conv._id),
        message,
        conversation: {
          lastBody: body,
          lastSenderId: String(user.sub),
          lastAt: now,
          lastDeletedBy: null,
          otherParticipant: recipientIsVenueSide && player
            ? { id: String(playerId), displayName: (player as any).displayName ?? 'Player', avatarUrl: (player as any).avatarUrl ?? null }
            : { id: String(user.sub), displayName: senderName, avatarUrl: senderAvatar },
          contextType: conv.contextType ?? null,
          contextId: conv.contextId ? String(conv.contextId) : null,
          // Unread from THIS recipient's perspective. A colleague's reply is the
          // venue's own answer — it doesn't leave unread work for the rest of them.
          unread: senderIsVenueSide && recipientIsVenueSide ? 0 : 1,
        },
      });
    }

    const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    // On a venue thread the player is talking to the venue, so a reply from the
    // owner (or their staff) is titled with the venue — "Oscar Walker" means
    // nothing to them. The venue side is titled with the player who messaged.
    const title = senderIsVenueSide && ctx.label ? ctx.label : senderName;
    await Promise.all(notifyTo.map((uid) => notifyUser(uid, {
      type: 'message',
      title,
      body: preview,
      icon: 'chat',
      linkUrl: `/messages/${String(conv._id)}`,
      tag: `message-${String(conv._id)}`,
    })));
  }

  return c.json({
    data: {
      id: String(msg._id),
      senderId: user.sub,
      body,
      createdAt: now,
      mine: true,
      fromVenueSide: senderIsVenueSide,
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
  if (!conv || !(await canAccess(conv, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const now = new Date();
  await markThreadRead(conv, user, now);

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
  if (!conv || !(await canAccess(conv, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  for (const uid of otherSideOf(await threadSides(conv), conv, String(user.sub))) {
    publishUserEvent(uid, 'message.typing', {
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
  if (!conv || !(await canAccess(conv, user))) {
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
  if (!conv || !(await canAccess(conv, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }
  const msg = await Message.findOne({ _id: msgId, conversationId: conv._id });
  if (!msg) return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  // Sharing the venue inbox doesn't extend to unsending a colleague's message.
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

  // Tell everyone who can see the thread — both participants and, on a venue
  // thread, the staff sharing the inbox — so their open chat + list update live.
  const deletedBy = String((msg as any).senderId);
  const convPreview = {
    lastBody: conv.lastBody ?? null,
    lastSenderId: conv.lastSenderId ? String(conv.lastSenderId) : null,
    lastAt: conv.lastAt ?? null,
    lastDeletedBy: conv.lastDeletedBy ? String(conv.lastDeletedBy) : null,
    deletedBy: deletedBy !== user.sub ? deletedBy : user.sub,
  };
  const payload = { conversationId: String(conv._id), messageId: String(msgId), conversation: convPreview };
  const viewers = new Set([String(user.sub), ...(await threadViewerIds(conv))]);
  for (const uid of viewers) publishUserEvent(uid, 'message.deleted', payload);

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

    // Auto intro message so the venue sees context immediately.
    const introVenueName = (venue as any).displayName || 'your venue';
    const introBody = `Hi, I have a question about ${introVenueName}.`;
    const now = new Date();
    const msg = await Message.create({ conversationId: conv._id, senderId: user.sub, body: introBody });
    conv.lastBody = introBody;
    conv.lastSenderId = user.sub as any;
    conv.lastAt = now;
    await conv.save();

    // The owner AND their staff — whoever gets to it first can answer.
    await announceVenueIntro({
      conv, senderId: user.sub, venueId, venueName: introVenueName,
      messageId: String(msg._id), body: introBody, at: now,
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
  // Same reach as the inbox: own threads + the venues the viewer works.
  const worked = await managedVenueIds(user);
  const convs = await Conversation.find({
    $or: [
      { participantIds: user.sub },
      ...(worked.length ? [{ contextType: 'venue', contextId: { $in: worked } }] : []),
    ],
    hiddenFor: { $ne: user.sub },
  }).select('reads').lean();
  let count = 0;
  await Promise.all(
    convs.map(async (cv: any) => {
      const since = new Date(readAtMs(cv, user.sub));
      count += await Message.countDocuments({ conversationId: cv._id, senderId: { $ne: user.sub }, deleted: { $ne: true }, createdAt: { $gt: since } });
    }),
  );
  return c.json({ data: { count } });
}
