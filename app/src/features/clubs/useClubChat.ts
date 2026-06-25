import { useEffect, useState } from 'react';
import { listClubMessages, sendClubMessage, type ApiClubMessage } from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';

/**
 * Club member-chat data: initial load + live append (the `club.message` SSE
 * event) + send. Shared by the full-screen `ClubChatScreen` (notification
 * deep-link target) and the inline `ClubChatPanel` (the club detail Chat tab).
 */
export function useClubChat(clubId: string) {
  const [messages, setMessages] = useState<ApiClubMessage[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listClubMessages(clubId)
      .then((res) => { if (!alive) return; setMessages(res.messages); setTitle(res.title); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load this chat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clubId]);

  // Realtime: append an incoming message for THIS club (deduped by id).
  useEffect(() => {
    return onRealtime('club.message', (p: any) => {
      if (!p || p.clubId !== clubId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [clubId]);

  const send = async (body: string) => {
    const msg = await sendClubMessage(clubId, body);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  return { messages, title, loading, error, send };
}
