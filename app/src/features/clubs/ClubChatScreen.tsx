import { ChatThread } from '../../shared/components/ui/ChatThread';
import { useClubChat } from './useClubChat';

interface ClubChatScreenProps {
  clubId: string;
  /** Club name, for the header. */
  name?: string;
  onBack: () => void;
}

/* Full-screen club member chat — the target for a club-chat notification
 * deep-link (`/clubs/:slug/chat`). In-app, the same conversation is reached as
 * the Chat tab on the club detail (ClubChatPanel); both share useClubChat. */
export function ClubChatScreen({ clubId, name, onBack }: ClubChatScreenProps) {
  const { messages, title, loading, error, send } = useClubChat(clubId);
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
    />
  );
}
