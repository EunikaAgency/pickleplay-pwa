import { useEffect, useState } from 'react';
import { ChatThread } from '../../../shared/components/ui/ChatThread';
import { listTournamentMessages, sendTournamentMessage, type ApiTournamentMessage } from '../../../shared/lib/api';
import { onRealtime } from '../../../shared/lib/realtimeBus';

interface TournamentChatScreenProps {
  tournamentId: string;
  /** Tournament name, for the header. */
  name?: string;
  onBack: () => void;
}

/* Participant group chat for a tournament's roster (organizer + every
 * registrant). Owns the fetch + realtime; the Messenger-style thread UI is the
 * shared ChatThread (also used by the game-roster chat). */
export function TournamentChatScreen({ tournamentId, name, onBack }: TournamentChatScreenProps) {
  const [messages, setMessages] = useState<ApiTournamentMessage[]>([]);
  // Seeded from the nav param, else filled in from the chat load (so a deep link
  // still shows the tournament name, not just "Tournament chat").
  const [title, setTitle] = useState<string>(name ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listTournamentMessages(tournamentId)
      .then((res) => {
        if (!alive) return;
        setMessages(res.messages);
        if (!name && res.title) setTitle(res.title);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this chat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId]);

  // Realtime: append an incoming message for THIS tournament (deduped by id).
  useEffect(() => {
    return onRealtime('tournament.message', (p: any) => {
      if (!p || p.tournamentId !== tournamentId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [tournamentId]);

  const onSend = async (body: string) => {
    const msg = await sendTournamentMessage(tournamentId, body);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  return (
    <ChatThread
      title={title}
      eyebrow="Tournament chat"
      messages={messages}
      loading={loading}
      error={error}
      placeholder="Message the players"
      emptyText="No messages yet — say hi to the players 👋"
      onBack={onBack}
      onSend={onSend}
    />
  );
}
