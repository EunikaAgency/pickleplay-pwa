import { Avatar } from '../../shared/components/ui/Avatar';
import { FeedShareCard } from './FeedShareCard';
import { relTime, linkifyBody } from './feedTime';
import type { FeedSharedPost } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface RepostQuoteProps {
  shared: FeedSharedPost;
  onNavigate: Navigate;
}

/** The quoted original inside a repost — a bordered mini-post; tap opens it. */
export function RepostQuote({ shared, onNavigate }: RepostQuoteProps) {
  return (
    <div
      role="button"
      onClick={(e) => { e.stopPropagation(); onNavigate('feed-post', { postId: shared.id }); }}
      className="mt-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
    >
      <div className="flex items-center gap-2">
        <Avatar src={shared.author?.avatarUrl} name={shared.author?.displayName ?? 'Player'} size={24} variant="blue" />
        <span className="font-semibold text-[13px] text-[var(--ink)] truncate">{shared.author?.displayName ?? 'Player'}</span>
        <span className="t-sm">· {relTime(shared.createdAt)}</span>
      </div>
      {shared.isDeleted ? (
        <p className="mt-1.5 text-[14px]"><em className="text-[var(--muted)]">This post was deleted.</em></p>
      ) : (
        <>
          {shared.body && <p className="mt-1.5 text-[14px] whitespace-pre-wrap break-words line-clamp-4">{linkifyBody(shared.body)}</p>}
          {shared.attachments?.[0] && <FeedShareCard attachment={shared.attachments[0]} onNavigate={onNavigate} compact />}
        </>
      )}
    </div>
  );
}
