import { useEffect, useState } from 'react';
import { ChatThread } from '../../../shared/components/ui/ChatThread';
import { listOpenPlayMessages, sendOpenPlayMessage, type ApiGameMessage } from '../../../shared/lib/api';
import { onRealtime } from '../../../shared/lib/realtimeBus';

interface OpenPlayChatScreenProps {
  sessionId: string;
  /** Session title, for the header. */
  name?: string;
  onBack: () => void;
}

/* Group chat for an organizer-published open-play session (organizer + everyone
 * who joined). The player-hosted flavour of Open Play is a Game, so it uses
 * GameChatScreen instead — both render the same shared ChatThread. */
export function OpenPlayChatScreen({ sessionId, name, onBack }: OpenPlayChatScreenProps) {
  const [messages, setMessages] = useState<ApiGameMessage[]>([]);
  // Seeded from the nav param, else filled in from the chat load (so a deep link
  // still shows the session name, not just "Open Play chat").
  const [title, setTitle] = useState<string>(name ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevSessionId, setPrevSessionId] = useState(sessionId);
  if (sessionId !== prevSessionId) {
    setPrevSessionId(sessionId);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    listOpenPlayMessages(sessionId)
      .then((res) => {
        if (!alive) return;
        setMessages(res.messages);
        if (!name && res.title) setTitle(res.title);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this chat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionId, name]);

  // Realtime: append an incoming message for THIS session (deduped by id).
  useEffect(() => {
    return onRealtime('openplay.message', (p: any) => {
      if (!p || p.sessionId !== sessionId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [sessionId, name]);

  const onSend = async (body: string) => {
    const msg = await sendOpenPlayMessage(sessionId, body);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  return (
    <ChatThread
      title={title}
      eyebrow="Open Play chat"
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
