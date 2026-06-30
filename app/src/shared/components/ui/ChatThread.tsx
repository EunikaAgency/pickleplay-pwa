import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { ErrorState } from './ErrorState';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ScreenHeader } from './ScreenHeader';
import { GameChatCard } from './GameChatCard';
import { MessageContextMenu, type MessageContextAction } from './MessageContextMenu';
import type { Navigate } from '../../lib/navigation';

/* Shared presentational group-chat thread (Messenger-style): grouped runs from
 * the same sender, grey received bubbles + blue sent bubbles, the sender avatar
 * pinned to the bottom of an incoming run, and an occasional centred timestamp.
 * Data (fetch + realtime) lives in the feature wrappers (GameChat / TournamentChat);
 * this owns only the draft/send UI + scroll. */

export interface ChatThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  body: string;
  card?: ChatCardData | null;
  createdAt: string;
  mine: boolean;
}

/** Shape of a rich game card embedded in a chat message. */
export interface ChatCardData {
  gameId: string;
  title?: string;
  subtitle?: string;
  gameType?: string;
  skillLabel?: string;
  dateTime?: string;
  venue?: string;
  imageUrl?: string;
  spotsLeft?: number;
  capacity?: number;
}

interface ChatThreadBodyProps {
  messages: ChatThreadMessage[];
  loading: boolean;
  error: string | null;
  placeholder: string;
  emptyText: string;
  /** Persist a message; throwing surfaces the inline send error. */
  onSend: (body: string) => Promise<unknown>;
  /** Edit your own message (sender-only). */
  onEditMessage?: (msgId: string, body: string) => Promise<unknown>;
  /** Delete your own message (sender-only). */
  onDeleteMessage?: (msgId: string) => Promise<unknown>;
  /** Optional navigation for tappable cards in chat. */
  onNavigate?: Navigate;
}

interface ChatThreadProps extends ChatThreadBodyProps {
  /** Header title (e.g. the game/tournament name). Falls back to `eyebrow`. */
  title: string;
  /** Header eyebrow + fallback title — e.g. 'Tournament chat'. */
  eyebrow: string;
  onBack: () => void;
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Minutes between two ISO timestamps (Infinity when either is missing/bad).
function gapMinutes(a?: string, b?: string): number {
  if (!a || !b) return Infinity;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return Infinity;
  return Math.abs(db - da) / 60000;
}

// Squish the corners that touch a neighbour in the same run so grouped bubbles
// read as one connected stack (Messenger look).
function bubbleRounding(mine: boolean, first: boolean, last: boolean): string {
  const r = ['rounded-[20px]'];
  if (mine) {
    if (!first) r.push('rounded-tr-[7px]');
    if (!last) r.push('rounded-br-[7px]');
  } else {
    if (!first) r.push('rounded-tl-[7px]');
    if (!last) r.push('rounded-bl-[7px]');
  }
  return r.join(' ');
}

/* The thread itself — message list + composer — with NO header or positioning.
 * Designed to fill a `flex flex-col` parent, so it works both inside the
 * full-screen `ChatThread` below and embedded in a tab/panel (e.g. the club
 * detail's Chat tab). */
export function ChatThreadBody({ messages, loading, error, placeholder, emptyText, onSend, onEditMessage, onDeleteMessage, onNavigate }: ChatThreadBodyProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep pinned to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, loading]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    setDraft('');
    try {
      await onSend(body);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Message not sent. Try again.');
      setDraft(body);
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

  // ── Message actions (copy / edit / delete) ──
  const copyBody = (body: string) => {
    navigator.clipboard.writeText(body).catch(() => {});
    setActionMsgId(null);
  };

  const startEdit = (m: ChatThreadMessage) => {
    setEditDraft(m.body);
    setEditingMsgId(m.id);
    setActionMsgId(null);
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditDraft('');
  };

  const saveEdit = async (msgId: string) => {
    if (!editDraft.trim() || !onEditMessage || editSaving) return;
    setEditSaving(true);
    try {
      await onEditMessage(msgId, editDraft.trim());
      setEditingMsgId(null);
      setEditDraft('');
    } catch {
      // keep the draft so the user can retry
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = (msgId: string) => {
    if (!onDeleteMessage) return;
    setActionMsgId(null);
    onDeleteMessage(msgId).catch(() => {});
  };

  // Long-press state
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressMsgId = useRef<string | null>(null);

  const startPress = (msgId: string) => {
    pressMsgId.current = msgId;
    pressTimer.current = setTimeout(() => {
      setActionMsgId(msgId);
      pressMsgId.current = null;
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressMsgId.current = null;
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-3 pt-2"><LoadingSkeleton variant="list-row" count={4} /></div>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="flex flex-col pt-2">
            {messages.length === 0 && (
              <div className="t-sm text-center py-8">{emptyText}</div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              // A "run" = consecutive messages from the same sender on the same side.
              const firstOfRun = !prev || prev.senderId !== m.senderId || prev.mine !== m.mine;
              const lastOfRun = !next || next.senderId !== m.senderId || next.mine !== m.mine;
              // Centred time marker only at the very top or after a real lull.
              const showTime = !prev || gapMinutes(prev.createdAt, m.createdAt) >= 10;
              const showName = !m.mine && firstOfRun;
              return (
                <div key={m.id}>
                  {showTime && (
                    <div className="text-center text-[11px] font-semibold text-[var(--muted)] my-3">{clockTime(m.createdAt)}</div>
                  )}
                  <div className={`flex items-end gap-1.5 ${m.mine ? 'justify-end' : 'justify-start'} ${firstOfRun && !showTime ? 'mt-2' : 'mt-0.5'}`}>
                    {!m.mine && (
                      lastOfRun
                        ? <Avatar src={m.senderAvatarUrl} name={m.senderName} size={26} />
                        : <div className="w-[26px] shrink-0" />
                    )}
                    <div className={`flex flex-col max-w-[82%] relative ${m.mine ? 'items-end' : 'items-start'}`}>
                      {showName && <div className="text-[12px] text-[var(--muted)] mb-1 ml-1">{m.senderName}</div>}
                      {/* Body bubble — only when there's actual text. Card-only messages skip the bubble entirely. */}
                      {editingMsgId === m.id ? (
                        <div className={`flex flex-col gap-1.5 w-full ${m.mine ? 'items-end' : 'items-start'}`}>
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={2}
                            maxLength={4000}
                            className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--field-border)] outline-none focus:border-[var(--lime)] text-[var(--ink)] resize-none text-[14px]"
                          />
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={cancelEdit} disabled={editSaving} className="px-3 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[12px] disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={() => saveEdit(m.id)} disabled={!editDraft.trim() || editSaving} className="px-3 py-1 rounded-lg bg-[var(--lime)] text-[var(--ink)] font-bold text-[12px] disabled:opacity-50">{editSaving ? 'Saving…' : 'Save'}</button>
                          </div>
                        </div>
                      ) : m.body.trim() ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onTouchStart={() => startPress(m.id)}
                          onTouchMove={cancelPress}
                          onTouchEnd={cancelPress}
                          onMouseDown={() => startPress(m.id)}
                          onMouseUp={cancelPress}
                          onMouseLeave={cancelPress}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`text-left px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap select-none cursor-pointer ${bubbleRounding(m.mine, firstOfRun, lastOfRun)} ${
                            m.mine ? 'bg-[var(--primary)] text-white active:bg-[var(--primary)]/80' : 'bg-[var(--surface-2)] text-[var(--ink)] active:bg-[var(--surface-3)]'
                          }`}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                        >
                          {m.body}
                        </div>
                      ) : null}

                      {/* Floating context menu anchored to the message */}
                      {actionMsgId === m.id && (
                        <MessageContextMenu
                          open
                          onClose={() => setActionMsgId(null)}
                          side={m.mine ? 'right' : 'left'}
                          actions={[
                            { key: 'copy', label: 'Copy', icon: 'content_copy', onPress: () => copyBody(m.body) },
                            ...(m.mine && onEditMessage && gapMinutes(m.createdAt, new Date().toISOString()) < 15
                              ? [{ key: 'edit', label: 'Edit', icon: 'edit', onPress: () => startEdit(m), visible: true } as MessageContextAction]
                              : []),
                            ...(m.mine && onDeleteMessage
                              ? [{ key: 'delete', label: 'Delete', icon: 'delete', danger: true, onPress: () => confirmDelete(m.id), visible: true } as MessageContextAction]
                              : []),
                          ]}
                        />
                      )}

                      {/* Rich invitation card — OUTSIDE the bubble, reads as a distinct shared item. */}
                      {m.card && (
                        <div
                          className={m.body.trim() ? 'mt-2 w-full' : 'w-full'}
                          onTouchStart={() => startPress(m.id)}
                          onTouchMove={cancelPress}
                          onTouchEnd={cancelPress}
                          onMouseDown={() => startPress(m.id)}
                          onMouseUp={cancelPress}
                          onMouseLeave={cancelPress}
                        >
                          <GameChatCard card={m.card} onNavigate={onNavigate} suppress={actionMsgId === m.id} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {sendError && <div className="px-4 pb-1 t-sm text-[var(--coral)] text-center">{sendError}</div>}

      <div className="border-t-[0.5px] border-[var(--hairline)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 h-11 px-4 rounded-full bg-[var(--surface-2)] text-[var(--ink)] text-[16px] outline-none"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </>
  );
}

/* Full-screen chat (game / tournament roster chat): a back-able header above the
 * shared thread body. Embedded surfaces (e.g. the club detail Chat tab) use
 * ChatThreadBody directly instead. */
export function ChatThread({ title, eyebrow, onBack, ...body }: ChatThreadProps) {
  return (
    <div className="absolute inset-0 flex flex-col pt-[env(safe-area-inset-top)] bg-[var(--bg)]">
      <ScreenHeader
        onBack={onBack}
        eyebrow={title ? eyebrow : undefined}
        title={title || eyebrow}
        className="border-b border-[rgba(0,0,0,0.12)] bg-[var(--bg)] shadow-[0_4px_14px_rgba(0,0,0,0.12)] z-10"
      />
      <ChatThreadBody {...body} />
    </div>
  );
}
