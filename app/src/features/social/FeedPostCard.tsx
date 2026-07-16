import { useState } from 'react';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { FeedShareCard } from './FeedShareCard';
import { FeedMedia } from './FeedMedia';
import { shareCardOf, mediaOf } from './feedAttachments';
import { RepostQuote } from './RepostQuote';
import { relTime, linkifyBody } from './feedTime';
import type { ApiFeedPost } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface FeedPostCardProps {
  post: ApiFeedPost;
  currentUserId?: string | null;
  onNavigate: Navigate;
  /** Open the post's permalink (tapping the body or the comment action). */
  onOpen: () => void;
  onToggleLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  /** Opens the author ⋯ action sheet. Omitted → no menu (not the author). */
  onOpenActions?: () => void;
}

/**
 * A single PickleFeed post, Threads/Facebook-style: avatar + author + time, the
 * body, an optional share card / reposted quote, then the like · comment ·
 * repost · share action row. Used by the feed list and the permalink header.
 */
export function FeedPostCard({ post, onNavigate, onOpen, onToggleLike, onRepost, onShare, onCopyLink, onOpenActions }: FeedPostCardProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <article className="about-card cursor-pointer !mb-3 !border-[var(--border)]" style={{ borderWidth: 1, boxShadow: '0 2px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2.5">
        <Avatar src={post.author?.avatarUrl} name={post.author?.displayName ?? 'Player'} size={40} variant="blue" />
        <div className="min-w-0">
          <div className="font-semibold text-[15px] text-[var(--ink)] truncate">{post.author?.displayName ?? 'Player'}</div>
          <div className="t-sm">{relTime(post.createdAt)}</div>
        </div>
        {onOpenActions && !post.isDeleted && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenActions(); }}
            aria-label="Post options"
            className="ml-auto shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] active:bg-[var(--surface-2)]"
          >
            <Icon name="more" size={18} />
          </button>
        )}
      </div>

      {/* Body — tapping it opens the permalink. */}
      <div role="button" onClick={onOpen} className="py-2.5">
        <p className="whitespace-pre-wrap break-words">
          {post.isDeleted ? <em className="text-[var(--muted)]">This post was deleted.</em> : linkifyBody(post.body ?? '')}
        </p>
        {!post.isDeleted && mediaOf(post.attachments).length > 0 && (
          <FeedMedia media={mediaOf(post.attachments)} />
        )}
        {!post.isDeleted && shareCardOf(post.attachments) && (
          <FeedShareCard attachment={shareCardOf(post.attachments)!} onNavigate={onNavigate} />
        )}
        {!post.isDeleted && post.sharedPost && (
          <RepostQuote shared={post.sharedPost} onNavigate={onNavigate} />
        )}
      </div>

      {/* Action row */}
      {!post.isDeleted && (
        <div className="mt-3 flex items-center gap-5 t-sm">
          <button
            onClick={onToggleLike}
            aria-pressed={post.viewerReacted}
            aria-label={post.viewerReacted ? 'Unlike' : 'Like'}
            className={`inline-flex items-center gap-1.5 font-bold ${post.viewerReacted ? 'text-[var(--coral)]' : 'text-[var(--muted)]'}`}
          >
            <Icon name={post.viewerReacted ? 'heart' : 'heart_o'} size={18} />
            {post.reactionCount > 0 ? post.reactionCount : 'Like'}
          </button>
          <button onClick={onOpen} aria-label="Comment" className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
            <Icon name="message" size={18} />
            {post.replyCount > 0 ? post.replyCount : 'Comment'}
          </button>
          <button onClick={onRepost} aria-label="Repost" className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
            <Icon name="repeat" size={18} />
            Repost
          </button>
          <div className="relative">
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share"
              className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]"
            >
              <Icon name="share" size={18} />
              Share
            </button>
          </div>
        </div>
      )}

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share post">
        <div className="flex flex-col gap-1 pb-2">
          <button
            type="button"
            onClick={() => { onCopyLink(); setShareOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
          >
            <Icon name="content_copy" size={18} /> Copy link
          </button>
          <button
            type="button"
            onClick={() => { onShare(); setShareOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
          >
            <Icon name="share" size={18} /> Share to social…
          </button>
        </div>
      </BottomSheet>
    </article>
  );
}
