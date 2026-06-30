import { useEffect, useState } from 'react';
import { ChatThread } from '../../shared/components/ui/ChatThread';
import { listGameMessages, sendGameMessage, type ApiGameMessage } from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';

interface GameChatScreenProps {
  gameId: string;
  /** Game title, for the header. */
  name?: string;
  onBack: () => void;
}

/* Group chat for a game's roster. Owns the fetch + realtime; the Messenger-style
 * thread UI is the shared ChatThread (also used by the tournament chat). */
export function GameChatScreen({ gameId, name, onBack }: GameChatScreenProps) {
  const [messages, setMessages] = useState<ApiGameMessage[]>([]);
  // Seeded from the nav param, else filled in from the chat load (so a deep link
  // still shows the game name, not just "Game chat").
  const [title, setTitle] = useState<string>(name ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevGameId, setPrevGameId] = useState(gameId);
  if (gameId !== prevGameId) {
    setPrevGameId(gameId);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    listGameMessages(gameId)
      .then((res) => {
        if (!alive) return;
        setMessages(res.messages);
        if (!name && res.title) setTitle(res.title);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this chat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gameId, name]);

  // Realtime: append an incoming message for THIS game (deduped by id).
  useEffect(() => {
    return onRealtime('game.message', (p: any) => {
      if (!p || p.gameId !== gameId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [gameId, name]);

  const onSend = async (body: string) => {
    const msg = await sendGameMessage(gameId, body);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  return (
    <ChatThread
      title={title}
      eyebrow="Game chat"
      messages={messages}
      loading={loading}
      error={error}
      placeholder="Message the group"
      emptyText="No messages yet — say hi to the group 👋"
      onBack={onBack}
      onSend={onSend}
    />
  );
}
