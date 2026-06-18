import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { listGameMessages, sendGameMessage, type ApiGameMessage } from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';

interface GameChatScreenProps {
  gameId: string;
  /** Game title, for the header. */
  name?: string;
  onBack: () => void;
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function GameChatScreen({ gameId, name, onBack }: GameChatScreenProps) {
  const [messages, setMessages] = useState<ApiGameMessage[]>([]);
  // The game's name for the header — seeded from the nav param, else filled in
  // from the chat load (so a deep link still shows the game name, not "Game chat").
  const [title, setTitle] = useState<string>(name ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listGameMessages(gameId)
      .then((res) => {
        if (!alive) return;
        setMessages(res.messages);
        if (!name && res.title) setTitle(res.title);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this chat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gameId]);

  // Realtime: append an incoming message for THIS game (deduped by id).
  useEffect(() => {
    return onRealtime('game.message', (p: any) => {
      if (!p || p.gameId !== gameId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [gameId]);

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
      const msg = await sendGameMessage(gameId, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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

  return (
    <div className="absolute inset-0 flex flex-col pt-[env(safe-area-inset-top)]">
      {/* When we know the game's name, show it as the title under a "Game chat"
          eyebrow; otherwise just show "Game chat" once (no doubled label). */}
      <ScreenHeader
        onBack={onBack}
        eyebrow={title ? 'Game chat' : undefined}
        title={title || 'Game chat'}
        className="border-b border-[rgba(0,0,0,0.12)] bg-[var(--bg)] shadow-[0_4px_14px_rgba(0,0,0,0.12)] z-10"
      />

      <div className="flex-1 overflow-y-auto px-5 lg:px-0 pb-4">
        {loading ? (
          <div className="space-y-3 pt-2"><LoadingSkeleton variant="list-row" count={4} /></div>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            {messages.length === 0 && (
              <div className="t-sm text-center py-8">No messages yet — say hi to the group 👋</div>
            )}
            {messages.map((m, i) => {
              // Show the sender's name+avatar only at the start of a run from the
              // same person (cleaner group-chat threading).
              const prev = messages[i - 1];
              const startOfRun = !m.mine && (!prev || prev.senderId !== m.senderId || prev.mine);
              return (
                <div key={m.id} className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  {!m.mine && (
                    startOfRun
                      ? <Avatar src={m.senderAvatarUrl} name={m.senderName} size={28} />
                      : <div className="w-7 shrink-0" />
                  )}
                  <div className={`max-w-[78%] ${m.mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {startOfRun && <div className="t-sm mb-0.5 ml-1">{m.senderName}</div>}
                    <div
                      className={`px-3.5 py-2 rounded-[18px] text-[15px] leading-snug break-words ${
                        m.mine
                          ? 'bg-[var(--primary)] text-white rounded-br-[6px]'
                          : 'bg-[var(--surface)] text-[var(--ink)] border-[0.5px] border-[var(--hairline)] rounded-bl-[6px]'
                      }`}
                    >
                      {m.body}
                      <div className={`text-[10px] mt-1 ${m.mine ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                        {clockTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {sendError && <div className="px-5 pb-1 t-sm text-[var(--coral)] text-center">{sendError}</div>}

      <div className="border-t-[0.5px] border-[var(--hairline)] px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the group"
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
