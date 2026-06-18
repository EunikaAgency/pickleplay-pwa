import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import {
  getConversation,
  sendMessage,
  deleteMessage,
  type ApiChatMessage,
  type ApiChatParticipant,
} from '../../shared/lib/api';
import { useNotificationStore } from '../../shared/lib/notificationStore';
import { onRealtime } from '../../shared/lib/realtimeBus';

interface ChatScreenProps {
  conversationId: string;
  /** Other participant's name, if known before load (for the header). */
  name?: string;
  onBack: () => void;
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function ChatScreen({ conversationId, name, onBack }: ChatScreenProps) {
  const [other, setOther] = useState<ApiChatParticipant | null>(name ? { id: '', displayName: name, avatarUrl: null } : null);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const refreshBadge = useNotificationStore((s) => s.refresh);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getConversation(conversationId)
      .then((conv) => {
        if (!alive) return;
        setOther(conv.otherParticipant);
        setMessages(conv.messages);
        // Opening the thread marked it read server-side; refresh the bell badge.
        void refreshBadge();
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this conversation.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [conversationId, refreshBadge]);

  // Realtime: append an incoming message for THIS thread the moment it arrives
  // over the SSE stream (deduped against our own optimistic append by id).
  useEffect(() => {
    return onRealtime('message', (p: any) => {
      if (!p || p.conversationId !== conversationId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [conversationId]);

  // Realtime: the other side deleted a message — drop it from the open thread.
  useEffect(() => {
    return onRealtime('message.deleted', (p: any) => {
      if (!p || p.conversationId !== conversationId || !p.messageId) return;
      setMessages((prev) => prev.filter((m) => m.id !== p.messageId));
    });
  }, [conversationId]);

  // Delete one of your own messages (long-press / tap your bubble → confirm).
  const removeMine = async (m: ApiChatMessage) => {
    if (!m.mine) return;
    if (!window.confirm('Delete this message?')) return;
    const prev = messages;
    setMessages((cur) => cur.filter((x) => x.id !== m.id)); // optimistic
    try {
      await deleteMessage(conversationId, m.id);
    } catch {
      setMessages(prev); // restore on failure
    }
  };

  // Keep the view pinned to the newest message.
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
      const msg = await sendMessage(conversationId, body);
      setMessages((prev) => [...prev, msg]);
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

  const displayName = other?.displayName ?? 'Player';

  return (
    <div className="absolute inset-0 flex flex-col pt-[env(safe-area-inset-top)]">
      <ScreenHeader
        onBack={onBack}
        title={displayName}
        eyebrow="Message"
        className="border-b border-[rgba(0,0,0,0.12)] bg-[var(--bg)] shadow-[0_4px_14px_rgba(0,0,0,0.12)] z-10"
      />

      <div className="flex-1 overflow-y-auto px-5 lg:px-0 pb-4">
        {loading ? (
          <div className="space-y-3 pt-2">
            <LoadingSkeleton variant="list-row" count={4} />
          </div>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            {messages.length === 0 && (
              <div className="t-sm text-center py-8">
                Say hello to {displayName} 👋
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                {!m.mine && <Avatar src={other?.avatarUrl} name={displayName} size={28} />}
                <div
                  onClick={m.mine ? () => removeMine(m) : undefined}
                  title={m.mine ? 'Tap to delete' : undefined}
                  className={`max-w-[78%] px-3.5 py-2 rounded-[18px] text-[15px] leading-snug break-words ${
                    m.mine
                      ? 'bg-[var(--primary)] text-white rounded-br-[6px] cursor-pointer'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[0.5px] border-[var(--hairline)] rounded-bl-[6px]'
                  }`}
                >
                  {m.body}
                  <div className={`text-[10px] mt-1 ${m.mine ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                    {clockTime(m.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {sendError && (
        <div className="px-5 pb-1 t-sm text-[var(--coral)] text-center">{sendError}</div>
      )}

      <div className="sticky bottom-0 bg-[var(--bg)] border-t-[0.5px] border-[var(--hairline)] px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message ${displayName}`}
          className="flex-1 h-11 px-3.5 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink)] text-[16px] outline-none"
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
  );
}
