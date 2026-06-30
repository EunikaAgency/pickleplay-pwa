import { useCallback } from 'react';
import { ChatThread } from '../../shared/components/ui/ChatThread';
import { useClubChat } from './useClubChat';
import { extractGameUrl, stripUrl, apiGameToCardData } from '../../shared/lib/game-link';
import { getGame } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface ClubChatScreenProps {
  clubId: string;
  /** Club name, for the header. */
  name?: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/* Full-screen club member chat — the target for a club-chat notification
 * deep-link (`/clubs/:slug/chat`). In-app, the same conversation is reached as
 * the Chat tab on the club detail (ClubChatPanel); both share useClubChat. */
export function ClubChatScreen({ clubId, name, onNavigate, onBack }: ClubChatScreenProps) {
  const { messages, title, loading, error, send: rawSend, edit, remove } = useClubChat(clubId);

  /** Detect game URLs in outgoing messages → fetch game → attach as a rich card. */
  const send = useCallback(async (body: string) => {
    const match = extractGameUrl(body);
    if (match) {
      try {
        const game = await getGame(match.gameId);
        const card = apiGameToCardData(game);
        await rawSend(stripUrl(body, match.url), card);
        return;
      } catch {
        // Game fetch failed — send as plain text so the URL still shows.
      }
    }
    await rawSend(body);
  }, [rawSend]);

  return (
    <ChatThread
      title={name ?? title ?? ''}
      eyebrow="Club chat"
      messages={messages}
      loading={loading}
      error={error}
      placeholder="Message the club"
      emptyText="No messages yet — say hi to the club 👋"
      onBack={onBack}
      onSend={send}
      onEditMessage={edit}
      onDeleteMessage={remove}
      onNavigate={onNavigate}
    />
  );
}
