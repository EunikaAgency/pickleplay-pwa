import { useCallback, useEffect, useState } from 'react';
import {
  listClubMessages, sendClubMessage, editClubMessage, deleteClubMessage,
  type ApiClubMessage, type GameLinkCard,
} from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';

/**
 * Club member-chat data: initial load + live append / edit / delete
 * (realtime SSE events) + send / edit / delete / copy functions.
 * Shared by the full-screen ClubChatScreen (notification deep-link target)
 * and the inline ClubChatPanel (the club detail Chat tab).
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

  // Realtime: new messages for this club (deduped by id).
  useEffect(() => {
    return onRealtime('club.message', (p: any) => {
      if (!p || p.clubId !== clubId || !p.message) return;
      setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    });
  }, [clubId]);

  // Realtime: edited messages — update in place.
  useEffect(() => {
    return onRealtime('club.message.edited', (p: any) => {
      if (!p || p.clubId !== clubId || !p.message) return;
      setMessages((prev) => prev.map((m) => (m.id === p.message.id ? { ...m, body: p.message.body } : m)));
    });
  }, [clubId]);

  // Realtime: deleted messages — drop from the list.
  useEffect(() => {
    return onRealtime('club.message.deleted', (p: any) => {
      if (!p || p.clubId !== clubId || !p.messageId) return;
      setMessages((prev) => prev.filter((m) => m.id !== p.messageId));
    });
  }, [clubId]);

  const send = async (body: string, card?: GameLinkCard) => {
    const msg = await sendClubMessage(clubId, body, card);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  const edit = useCallback(async (msgId: string, body: string) => {
    const updated = await editClubMessage(clubId, msgId, body);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
  }, [clubId]);

  const remove = useCallback(async (msgId: string) => {
    await deleteClubMessage(clubId, msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [clubId]);

  return { messages, title, loading, error, send, edit, remove };
}
