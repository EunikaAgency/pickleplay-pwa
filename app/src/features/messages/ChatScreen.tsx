import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CheckCheck, CornerUpLeft } from 'lucide-react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import {
  getConversation,
  sendMessage,
  markConversationRead,
  sendTyping,
  deleteMessage,
  apiImageUrl,
  type ApiChatMessage,
  type ApiChatParticipant,
} from '../../shared/lib/api';
import { useNotificationStore } from '../../shared/lib/notificationStore';
import { useMessageStore } from '../../shared/lib/messageStore';
import { onRealtime } from '../../shared/lib/realtimeBus';

interface ChatScreenProps {
  conversationId: string;
  /** Other participant's name, if known before load (for the header). */
  name?: string;
  onBack: () => void;
}

type LocalChatMessage = ApiChatMessage & {
  _replyTo?: ApiChatMessage | null;
  _replyDeleted?: boolean;
  _deleted?: boolean;
};

type RealtimeMessagePayload = {
  conversationId?: string;
  message?: ApiChatMessage;
};

type RealtimeDeletePayload = {
  conversationId?: string;
  messageId?: string;
};

type RealtimeReadPayload = {
  conversationId?: string;
  readAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatMessage(value: unknown): value is ApiChatMessage {
  return isRecord(value) && typeof value.id === 'string' && typeof value.body === 'string';
}

function realtimeMessagePayload(value: unknown): RealtimeMessagePayload | null {
  if (!isRecord(value)) return null;
  const message = isChatMessage(value.message) ? value.message : undefined;
  return {
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : undefined,
    message,
  };
}

function realtimeDeletePayload(value: unknown): RealtimeDeletePayload | null {
  if (!isRecord(value)) return null;
  return {
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : undefined,
    messageId: typeof value.messageId === 'string' ? value.messageId : undefined,
  };
}

function realtimeReadPayload(value: unknown): RealtimeReadPayload | null {
  if (!isRecord(value)) return null;
  return {
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : undefined,
    readAt: typeof value.readAt === 'string' ? value.readAt : undefined,
  };
}

function wasReadBy(readAt: string | undefined, createdAt: string | undefined): boolean {
  if (!readAt || !createdAt) return false;
  const readTime = new Date(readAt).getTime();
  const createdTime = new Date(createdAt).getTime();
  return Number.isFinite(readTime) && Number.isFinite(createdTime) && createdTime <= readTime;
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Consider a user "active" if their last activity was within this many minutes. */
const ACTIVE_WINDOW_MIN = 5;

function isActive(iso?: string | null): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) < ACTIVE_WINDOW_MIN * 60_000;
}

export function ChatScreen({ conversationId, name, onBack }: ChatScreenProps) {
  const [other, setOther] = useState<ApiChatParticipant | null>(name ? { id: '', displayName: name, avatarUrl: null } : null);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** Set on a venue-scoped thread: the venue this conversation is about. */
  const [venue, setVenue] = useState<{ name: string; imageUrl: string | null; viewerIsVenueSide: boolean } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuFlipUp, setMenuFlipUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ApiChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const isNearBottomRef = useRef(true);
  const refreshBadge = useNotificationStore((s) => s.refresh);
  const refreshMessages = useMessageStore((s) => s.refresh);

  // Smart auto-scroll: only scroll to bottom when the user is already there
  // (within 120px). If they're reading older messages, don't yank the viewport.
  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // "Near bottom" = within 120px of the bottom edge
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const [prevConvId, setPrevConvId] = useState(conversationId);
  if (conversationId !== prevConvId) {
    setPrevConvId(conversationId);
    setLoading(true);
    setError(null);
    setReplyTo(null);
    setOpenMenuId(null);
    setHighlightedMessageId(null);
  }

  useEffect(() => {
    let alive = true;
    getConversation(conversationId)
      .then((conv) => {
        if (!alive) return;
        setOther(conv.otherParticipant);
        setMessages(conv.messages);
        setVenue(conv.contextLabel
          ? {
            name: conv.contextLabel,
            imageUrl: conv.contextImageUrl ? apiImageUrl(conv.contextImageUrl) : null,
            viewerIsVenueSide: conv.viewerIsVenueSide === true,
          }
          : null);
        // Mark the conversation read server-side so the unread-message badge drops.
        void markConversationRead(conversationId).then(() => {
          refreshBadge();
          refreshMessages();
        });
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this conversation.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [conversationId, refreshBadge]);

  // Realtime: append an incoming message for THIS thread the moment it arrives
  // over the SSE stream (deduped against our own optimistic append by id).
  useEffect(() => {
    return onRealtime('message', (payload: unknown) => {
      const p = realtimeMessagePayload(payload);
      if (!p || p.conversationId !== conversationId || !p.message) return;
      const message = p.message;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      if (!message.mine) void markConversationRead(conversationId).then(() => refreshMessages());
    });
  }, [conversationId]);

  // Realtime: the other side read this thread — mark my sent bubbles seen.
  useEffect(() => {
    return onRealtime('message.read', (payload: unknown) => {
      const p = realtimeReadPayload(payload);
      if (!p || p.conversationId !== conversationId || !p.readAt) return;
      setMessages((prev) => prev.map((m) => (m.mine && wasReadBy(p.readAt, m.createdAt)
        ? { ...m, readByOther: true, readAtByOther: p.readAt }
        : m)));
    });
  }, [conversationId]);

  // Realtime: the other side deleted a message — mark it as deleted in the
  // thread (shows a placeholder) and clear any reply previews that reference it.
  useEffect(() => {
    return onRealtime('message.deleted', (payload: unknown) => {
      const p = realtimeDeletePayload(payload);
      if (!p || p.conversationId !== conversationId || !p.messageId) return;
      setMessages((prev) => prev
        .map((m) => {
          if (m.id === p.messageId) return { ...m, _deleted: true } as LocalChatMessage;
          // Clear the replyTo for any message that was replying to the deleted one.
          if ((m as LocalChatMessage).replyToMessageId === p.messageId || (m as LocalChatMessage).replyTo?.id === p.messageId || (m as LocalChatMessage)._replyTo?.id === p.messageId) {
            return {
              ...m,
              replyTo: undefined,
              _replyTo: undefined,
              _replyDeleted: true,
            } as LocalChatMessage;
          }
          return m;
        }));
    });
  }, [conversationId]);

  // Realtime: the other side is typing — show the indicator, then clear after a
  // short timeout (they send a new event for every keystroke, so we reset the
  // timer on each one).
  useEffect(() => {
    return onRealtime('typing', (payload: unknown) => {
      if (!isRecord(payload)) return;
      const cid = typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
      if (cid !== conversationId) return;
      setTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTyping(false), 3000);
    });
  }, [conversationId]);

  // Close the 3-dot dropdown on Escape.
  useEffect(() => {
    if (!openMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenuId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openMenuId]);

  // Close the 3-dot dropdown on outside click.
  useEffect(() => {
    if (!openMenuId) return;
    const dismiss = () => setOpenMenuId(null);
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 100);
    return () => { clearTimeout(t); document.removeEventListener('click', dismiss); };
  }, [openMenuId]);

  // Flip the 3-dot menu upward when it would overflow the viewport bottom.
  useEffect(() => {
    if (!openMenuId) { setMenuFlipUp(false); return; }
    const raf = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      setMenuFlipUp(rect.bottom > window.innerHeight);
    });
    return () => cancelAnimationFrame(raf);
  }, [openMenuId]);

  // Delete one of your own messages (long-press / tap your bubble -> confirm).
  const removeMine = async (m: ApiChatMessage) => {
    if (!m.mine) return;
    if (!window.confirm('Delete this message?')) return;
    const prev = messages;
    setMessages((cur) =>
      cur.map((x) => {
        // Mark the deleted message with a placeholder instead of removing it.
        if (x.id === m.id) return { ...x, _deleted: true } as LocalChatMessage;
        // Clear reply references so reply previews show "Message removed".
        const lx = x as LocalChatMessage;
        if (lx.replyToMessageId === m.id || lx.replyTo?.id === m.id || lx._replyTo?.id === m.id) {
          return { ...x, replyTo: undefined, _replyTo: undefined, _replyDeleted: true } as LocalChatMessage;
        }
        return x;
      }),
    );
    try {
      await deleteMessage(conversationId, m.id);
    } catch {
      setMessages(prev); // restore on failure
    }
  };

  // Auto-scroll on initial load (force) and on new messages (only when near bottom).
  useEffect(() => {
    if (loading) return;
    // Force scroll on initial load, but only if near bottom for subsequent messages
    scrollToBottom(true);
    // After the initial forced scroll, let subsequent message arrivals use the
    // smart behavior (only scroll when user is already near the bottom).
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  const setMessageNode = (id: string, node: HTMLDivElement | null) => {
    if (node) {
      messageRefs.current.set(id, node);
    } else {
      messageRefs.current.delete(id);
    }
  };

  const jumpToMessage = (messageId?: string | null) => {
    if (!messageId) return;
    const node = messageRefs.current.get(messageId);
    if (!node) return;
    setHighlightedMessageId(messageId);
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 1400);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    setDraft('');
    const replyingTo = replyTo;
    try {
      const msg = await sendMessage(conversationId, body, replyingTo?.id ?? null);
      // Attach reply metadata inline so it renders immediately.
      const augmented = replyingTo ? { ...msg, _replyTo: replyingTo } : msg;
      setMessages((prev) => [...prev, augmented]);
      setReplyTo(null);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Message not sent. Try again.');
      setDraft(body); // restore so the user doesn't lose their text
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Debounced typing indicator sender — fires at most once every 2s while the
  // user is typing, then stops. Best-effort: failures are silent (the indicator
  // is a nicety, not a guarantee).
  const throttleTyping = () => {
    const now = Date.now();
    if (now - typingSentRef.current < 2000) return;
    typingSentRef.current = now;
    void sendTyping(conversationId).catch(() => {});
  };

  // A player who messaged a venue is talking to the VENUE, so the thread reads as
  // the venue (its name + photo) — the owner's personal name means nothing to them.
  // The venue side (owner + staff) keeps seeing the player, with the venue named
  // in the eyebrow.
  const asVenue = venue && !venue.viewerIsVenueSide ? venue : null;
  // Staff share the venue's inbox, so a colleague's reply is the VENUE talking —
  // it belongs on the outgoing side, not mixed in with the player's messages.
  const venueSide = venue?.viewerIsVenueSide === true;
  const displayName = asVenue?.name ?? other?.displayName ?? 'Player';
  const avatarSrc = asVenue ? asVenue.imageUrl : (other?.avatarUrl ?? null);
  const active = isActive(other?.lastActiveAt);
  const presence = other?.lastActiveAt != null ? (active ? 'Active now' : 'Inactive') : undefined;

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-200 pt-[env(safe-area-inset-top)]">
      <ScreenHeader
        onBack={onBack}
        title={displayName}
        eyebrow={asVenue ? 'Venue' : venue ? `Re: ${venue.name}` : 'Message'}
        // Under the venue, name the person who actually replies, so the player
        // isn't surprised by a stranger's name on the incoming messages.
        subtitle={asVenue
          ? ([other?.displayName, presence].filter(Boolean).join(' · ') || undefined)
          : presence}
        className="border-b border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.08)] z-10"
      />

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto bg-slate-200 px-6 pb-4">
        {loading ? (
          <div className="space-y-3 pt-2">
            <LoadingSkeleton variant="list-row" count={4} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => { setError(''); setLoading(true); }} />
        ) : (
          <div className="flex flex-col gap-2 pt-4">
            {messages.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                Say hello to {displayName} 👋
              </div>
            )}
            {messages.map((m) => {
              // On the venue side a colleague's reply is the venue talking, so it
              // sits on the outgoing side — but only my OWN messages are unsendable
              // (`m.mine`), and only mine carry a read receipt.
              const fromColleague = venueSide && m.fromVenueSide === true && !m.mine;
              const isMine = m.mine || fromColleague;
              const isDeleted = m.deleted === true || (m as LocalChatMessage)._deleted === true;
              const menuOpen = openMenuId === m.id;
              const bubbleCls = isDeleted
                ? 'bg-slate-100 text-slate-400 italic text-[13px] border border-slate-200'
                : isMine
                  ? 'bg-[var(--primary)] text-white rounded-br-[6px]'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-sm rounded-bl-[6px]';
              const tsCls = isMine ? 'text-white/70' : 'text-slate-500';

              // Inline _replyTo (set on send) or lookup by replyToMessageId (realtime / API).
              const localMessage = m as LocalChatMessage;
              const rawReplied = localMessage._replyTo
                ?? localMessage.replyTo
                ?? (localMessage.replyToMessageId
                  ? messages.find((x) => x.id === localMessage.replyToMessageId)
                  : undefined);
              const replyDeleted = localMessage._replyDeleted === true || rawReplied?.deleted === true;
              const repliedMsg = replyDeleted ? undefined : rawReplied;

              const repliedAuthor = repliedMsg?.mine
                ? 'yourself'
                : (repliedMsg?.senderName || displayName);
              const repliedMessageId = repliedMsg?.id ?? localMessage.replyToMessageId ?? null;
              const canJumpToReply = Boolean(repliedMessageId && messages.some((x) => x.id === repliedMessageId));
              const isHighlighted = highlightedMessageId === m.id;
              const receiptLabel = m.readByOther ? 'Seen' : 'Sent';
              const ReceiptIcon = m.readByOther ? CheckCheck : Check;

              return (
                <motion.div
                  key={m.id}
                  ref={(node) => setMessageNode(m.id, node)}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
                  layout
                  className={`group relative flex items-end gap-2 rounded-[22px] transition-shadow duration-300 ${isMine ? 'justify-end' : 'justify-start'} ${isHighlighted ? 'shadow-[0_0_0_3px_rgba(204,255,51,0.95),0_0_0_7px_rgba(0,64,224,0.16)]' : ''}`}
                  onClick={() => setActiveMessageId(activeMessageId === m.id ? null : m.id)}
                >
                  {!isMine && (
                    <div className="relative shrink-0">
                      <Avatar src={avatarSrc} name={displayName} size={28} />
                      {other?.lastActiveAt != null && (
                        <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                      )}
                    </div>
                  )}

                  <div className={`relative flex max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* ── reply preview ── */}
                    {(repliedMsg || replyDeleted || localMessage.replyToMessageId) && (
                      <div
                        className={[
                          `mb-1 flex max-w-full flex-col ${isMine ? 'items-end' : 'items-start'}`,
                          canJumpToReply ? 'cursor-pointer' : 'cursor-default',
                        ].join(' ')}
                        onClick={canJumpToReply ? (e: React.MouseEvent) => { e.stopPropagation(); jumpToMessage(repliedMessageId); } : undefined}
                      >
                        <div className={`mb-1 flex items-center gap-1 text-[11px] leading-none text-slate-500 ${isMine ? 'justify-end text-right' : 'justify-start text-left'}`}>
                          <CornerUpLeft className="h-3 w-3" />
                          <span>
                            {replyDeleted || !repliedMsg
                              ? (isMine ? 'You replied to a removed message' : `${displayName} replied to a removed message`)
                              : (isMine
                                ? `You replied to ${repliedAuthor}`
                                : `${displayName} replied to ${repliedMsg.mine ? 'you' : repliedAuthor}`)}
                          </span>
                        </div>
                        <div
                          className={[
                            'max-w-full overflow-hidden rounded-[18px] px-3 py-2 text-left text-sm leading-snug break-words border-l-[3px]',
                            replyDeleted || !repliedMsg
                              ? 'italic text-slate-400 bg-slate-100 border-slate-300'
                              : 'text-slate-700 bg-[#EEF2FF] border-[var(--primary)] transition-colors',
                            isMine
                              ? 'rounded-br-[7px]'
                              : 'rounded-bl-[7px]',
                            canJumpToReply && !replyDeleted ? 'hover:bg-[#E0E7FF] active:scale-[0.99]' : '',
                          ].join(' ')}
                        >
                          {replyDeleted || !repliedMsg ? 'Message removed' : repliedMsg.body}
                        </div>
                      </div>
                    )}

                    {/* ── message bubble + actions (relative wrapper so actions center on the bubble, not the column) ── */}
                    <div className="relative">
                      {/* ── message bubble ── */}
                      <div
                        className={`px-3.5 py-2 rounded-[18px] text-[15px] leading-snug break-words ${bubbleCls}`}
                      >
                        {isDeleted
                          ? (m.mine
                            ? 'You deleted a message'
                            : `${fromColleague ? (m.senderName ?? 'A colleague') : displayName} deleted a message`)
                          : m.body}
                        {!isDeleted && (
                          <div className={`mt-1 flex items-center gap-1 text-[10px] ${isMine ? 'justify-end' : 'justify-start'} ${tsCls}`}>
                            {/* Whose reply this was — the venue inbox is shared. */}
                            {fromColleague && m.senderName && <span className="font-semibold">{m.senderName}</span>}
                            <span>{clockTime(m.createdAt)}</span>
                            {m.mine && (
                              <span
                                className={`inline-flex items-center gap-0.5 ${m.readByOther ? 'text-[var(--lime)]' : 'text-white/75'}`}
                                title={receiptLabel}
                                aria-label={receiptLabel}
                              >
                                <ReceiptIcon className="h-3 w-3" strokeWidth={2.5} />
                                <span>{receiptLabel}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── floating hover actions ── */}
                      {!isDeleted && (
                      <div
                        className={[
                          'absolute top-1/2 z-40 flex -translate-y-1/2 items-center gap-0.5',
                          'opacity-0 pointer-events-none transition-opacity',
                          'group-hover:opacity-100 group-hover:pointer-events-auto',
                          activeMessageId === m.id ? 'opacity-100 pointer-events-auto' : '',
                          isMine ? 'right-full mr-2' : 'left-full ml-2',
                        ].join(' ')}
                      >
                      <button
                        type="button"
                        aria-label="Reply to message"
                        onClick={(e) => { e.stopPropagation(); setReplyTo(m); }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-white shadow hover:bg-neutral-600 active:scale-90 transition-transform"
                      >
                        <CornerUpLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="More message options"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : m.id); }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-white shadow hover:bg-neutral-600 active:scale-90 transition-transform"
                      >
                        <Icon name="more" size={16} />
                      </button>
                    </div>
                    )}

                    {/* ── 3-dot dropdown ── */}
                    {!isDeleted && menuOpen && (
                      <div
                        ref={menuRef}
                        className={`absolute ${isMine ? 'right-0' : 'left-0'} ${menuFlipUp ? 'bottom-full mb-2' : 'top-full mt-2'} rounded-xl bg-neutral-800 text-white shadow-xl border border-white/10 py-2 z-50 min-w-[140px]`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Only your OWN message — sharing the venue inbox doesn't let
                            you unsend a colleague's reply (the server 403s anyway). */}
                        {m.mine && (
                          <button
                            type="button"
                            onClick={() => { removeMine(m); setOpenMenuId(null); }}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                          >
                            Unsend
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(null)}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                        >
                          Forward
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(null)}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                        >
                          Pin
                        </button>
                        {!isMine && (
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(null)}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                          >
                            Report
                          </button>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── typing indicator ── */}
      <AnimatePresence>
        {typing && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="px-6 pb-1 flex items-center gap-2 overflow-hidden"
          >
            <div className="relative shrink-0">
              <Avatar src={avatarSrc} name={displayName} size={24} />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-[7px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky bottom-0 z-30 border-t border-slate-300 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="border-b border-slate-200 bg-slate-50 overflow-hidden"
          >
            <div className="px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Replying to {replyTo.mine ? 'yourself' : displayName}
              </div>
              <div className="mt-1 truncate text-sm text-slate-700">
                {replyTo.body}
              </div>
            </div>
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
              className="rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 shrink-0"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
          </motion.div>
        )}
        </AnimatePresence>

      {sendError && (
        <div className="px-5 pb-1 t-sm text-[var(--coral)] text-center">{sendError}</div>
      )}

      <div className="flex items-center gap-2 px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); throttleTyping(); }}
          onKeyDown={onKeyDown}
          placeholder={replyTo ? 'Type a reply…' : `Message ${displayName}`}
          className="flex-1 h-11 px-4 rounded-full border border-slate-300 bg-white text-[var(--ink)] text-[16px] outline-none placeholder:text-slate-400"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
      </div>
    </div>
  );
}
