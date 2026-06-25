import { ChatThreadBody } from '../../shared/components/ui/ChatThread';
import { useClubChat } from './useClubChat';

/**
 * The club member chat rendered inline as the club detail's **Chat tab** (vs. the
 * full-screen ClubChatScreen used for notification deep-links). Fills the area
 * below the hero/tabs with an internally-scrolling thread + a composer pinned to
 * its bottom; shares the live data with the full-screen surface via useClubChat.
 */
export function ClubChatPanel({ clubId }: { clubId: string }) {
  const { messages, loading, error, send } = useClubChat(clubId);
  return (
    <div className="flex flex-col h-[calc(100dvh-340px)] min-h-[320px] -mx-1">
      <ChatThreadBody
        messages={messages}
        loading={loading}
        error={error}
        placeholder="Message the club"
        emptyText="No messages yet — say hi to the club 👋"
        onSend={send}
      />
    </div>
  );
}
