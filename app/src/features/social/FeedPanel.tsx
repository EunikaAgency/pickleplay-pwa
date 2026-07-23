import { useEffect, useRef, useState } from 'react';
import type { V2ScreenChrome } from '../../shared/components/layout/V2Chrome';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { V2Skeleton } from '../../shared/components/ui/V2Skeleton';
import { Toast } from '../../shared/components/ui/Toast';
import { useAuthStore } from '../../shared/lib/authStore';
import { REPORT_REASONS } from '../../shared/lib/reportReasons';
import {
  listFeed, reactFeedPost, unreactFeedPost, deleteFeedPost,
  setFeedSignal, hideFeedPost, reportFeedPost, subscribeFeedPost, unsubscribeFeedPost,
  type ApiFeedPost, type FeedSharedPost,
} from '../../shared/lib/api';
import { FeedPostCard } from './FeedPostCard';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { FeedComposerSheet } from './FeedComposerSheet';

interface FeedPanelProps {
  chrome: V2ScreenChrome;
}

/** Build the repost snapshot the composer quotes from a post being reposted. */
function toShared(p: ApiFeedPost): FeedSharedPost {
  return {
    id: p.id, author: p.author, authorId: p.authorId,
    body: p.body, attachments: p.attachments, isDeleted: p.isDeleted, createdAt: p.createdAt,
  };
}

/**
 * PickleFeed — the global newsfeed. A "What's new?" composer trigger up top,
 * then a cursor-paginated list of posts with like / comment / repost / share.
 * Body only — SocialScreen owns the shell.
 */
export function FeedPanel({ chrome }: FeedPanelProps) {
  const { onNavigate, requireAuth, isLoggedIn } = chrome;
  const currentUser = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<ApiFeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [repostTarget, setRepostTarget] = useState<FeedSharedPost | null>(null);
  const [actionTarget, setActionTarget] = useState<ApiFeedPost | null>(null);
  const [reportTarget, setReportTarget] = useState<ApiFeedPost | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  useEffect(() => {
    let alive = true;
    listFeed({ pageSize: 12 })
      .then((page) => { if (alive) { setPosts(page.items); setCursor(page.cursor); setError(false); } })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn, reloadKey]);

  // Infinite scroll — Intersection Observer on the sentinel.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadingMore]);

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    listFeed({ cursor, pageSize: 12 })
      .then((page) => { setPosts((prev) => [...prev, ...page.items]); setCursor(page.cursor); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const openComposer = () => { if (!requireAuth('post to the feed')) return; setRepostTarget(null); setComposerOpen(true); };

  const onPosted = (post: ApiFeedPost) => {
    // A top-level post (or repost) prepends to the feed; a comment doesn't show here.
    if (!post.parentPostId) setPosts((prev) => [post, ...prev]);
  };

  const toggleLike = (post: ApiFeedPost) => {
    if (!requireAuth('like posts')) return;
    const liked = post.viewerReacted;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerReacted: !liked, reactionCount: p.reactionCount + (liked ? -1 : 1) } : p)));
    (liked ? unreactFeedPost(post.id) : reactFeedPost(post.id)).catch(() => {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerReacted: liked, reactionCount: p.reactionCount + (liked ? 1 : -1) } : p)));
    });
  };

  const repost = (post: ApiFeedPost) => {
    if (!requireAuth('repost')) return;
    setRepostTarget(toShared(post));
    setComposerOpen(true);
  };

  const copyLink = async (post: ApiFeedPost) => {
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    } catch { showToast("Couldn't copy link"); }
  };

  const share = async (post: ApiFeedPost) => {
    const url = `${window.location.origin}/feed/${post.id}`;
    const text = post.body ? post.body.slice(0, 120) : 'Check out this post on PickleBallers';
    try {
      if (navigator.share) await navigator.share({ title: 'PickleBallers', text, url });
      else { await navigator.clipboard.writeText(url); showToast('Link copied'); }
    } catch { /* user dismissed the share sheet — ignore */ }
  };

  const confirmDelete = async () => {
    if (!actionTarget) return;
    const id = actionTarget.id;
    const target = actionTarget;
    setActionTarget(null);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isDeleted: true, body: null } : p)));
    try { await deleteFeedPost(id); } catch {
      showToast("Couldn't delete");
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isDeleted: target.isDeleted, body: target.body } : p)));
    }
  };

  // ── Non-author post actions (interested / hide / report / notify) ──
  const authorName = (p: ApiFeedPost) => p.author?.displayName ?? 'this player';

  // Interested / Not interested — a per-author feed preference. Tapping the
  // active one again clears it. `not_interested` mutes the author (drops their
  // posts now); `interested` marks them (server floats + de-clusters).
  const applySignal = (post: ApiFeedPost, type: 'interested' | 'not_interested') => {
    setActionTarget(null);
    if (!requireAuth('personalize your feed')) return;
    const authorId = post.author?.id;
    if (!authorId) return;
    const next = post.viewerAuthorSignal === type ? 'clear' : type;
    const prevPosts = [...posts];
    if (next === 'not_interested') {
      setPosts((prev) => prev.filter((p) => p.author?.id !== authorId));
      showToast(`You'll see less from ${authorName(post)}`);
    } else if (next === 'interested') {
      setPosts((prev) => prev.map((p) => (p.author?.id === authorId ? { ...p, viewerAuthorSignal: 'interested' } : p)));
      showToast(`You'll see more from ${authorName(post)}`);
    } else {
      setPosts((prev) => prev.map((p) => (p.author?.id === authorId ? { ...p, viewerAuthorSignal: null } : p)));
      showToast('Preference cleared');
    }
    setFeedSignal(authorId, next).catch(() => { showToast("Couldn't save that"); setPosts(prevPosts); });
  };

  const hidePost = (post: ApiFeedPost) => {
    setActionTarget(null);
    if (!requireAuth('hide posts')) return;
    const prevPosts = [...posts];
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    showToast('Hidden for a day');
    hideFeedPost(post.id).catch(() => { showToast("Couldn't hide"); setPosts(prevPosts); });
  };

  // Tapping "Report post" opens a reason picker; picking a reason submits it.
  const reportPost = (post: ApiFeedPost) => {
    setActionTarget(null);
    if (!requireAuth('report posts')) return;
    setReportTarget(post);
  };
  const submitReport = (reason: string) => {
    const post = reportTarget;
    setReportTarget(null);
    if (!post) return;
    showToast("Thanks — we'll take a look");
    reportFeedPost(post.id, reason).catch(() => showToast("Couldn't report"));
  };

  const toggleNotify = (post: ApiFeedPost) => {
    setActionTarget(null);
    if (!requireAuth('get notified')) return;
    const on = !post.viewerNotify;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerNotify: on } : p)));
    showToast(on ? 'Notifications on for this post' : 'Notifications off');
    (on ? subscribeFeedPost(post.id) : unsubscribeFeedPost(post.id)).catch(() => {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewerNotify: !on } : p)));
      showToast("Couldn't update");
    });
  };

  return (
    <>
      {/* Composer trigger — Facebook-style "What's new?" bar. */}
      <div className="feed-composer-trigger" role="button" onClick={openComposer}>
        <Avatar src={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'You'} size={38} variant="blue" />
        <span className="feed-composer-placeholder">What's new?</span>
        <span className="feed-composer-post" aria-hidden="true">Create New Post</span>
      </div>

      {loading ? (
        <V2Skeleton variant="club-list" count={4} />
      ) : error ? (
        <ErrorState message="Couldn't load posts." onRetry={() => { setError(false); setReloadKey((k) => k + 1); }} />
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📣</div>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              currentUserId={currentUser?.id}
              onNavigate={onNavigate}
              onOpen={() => onNavigate('feed-post', { postId: post.id })}
              onToggleLike={() => toggleLike(post)}
              onRepost={() => repost(post)}
              onShare={() => share(post)}
              onCopyLink={() => copyLink(post)}
              onOpenActions={() => setActionTarget(post)}
            />
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <span className="t-sm text-[var(--muted)]">Loading…</span>
        </div>
      )}

      <div style={{ height: 20 }} />

      <FeedComposerSheet open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={onPosted} repostOf={repostTarget} />

      {/* Post ⋯ actions — author gets edit/delete, everyone else gets the
          interested / report / hide / notify menu. */}
      <BottomSheet open={!!actionTarget} onClose={() => setActionTarget(null)} title="Post">
        {actionTarget && (() => {
          const t = actionTarget;
          const isOwn = !!currentUser && t.author?.id === currentUser.id;
          const row = 'w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold active:bg-[var(--surface-2)] rounded-xl';
          const rule = <div className="my-1 h-px bg-[var(--border)]" />;
          const notifyRow = (
            <button type="button" onClick={() => toggleNotify(t)} className={`${row} text-[var(--ink)]`}>
              <Icon name="bell" size={18} /> {t.viewerNotify ? 'Turn off notifications' : 'Turn on notifications for this post'}
            </button>
          );
          if (isOwn) {
            return (
              <div className="flex flex-col gap-1 pb-2">
                <button
                  type="button"
                  onClick={() => { setActionTarget(null); onNavigate('feed-post', { postId: t.id }); }}
                  className={`${row} text-[var(--ink)]`}
                >
                  <Icon name="edit" size={18} /> Edit post
                </button>
                <button type="button" onClick={confirmDelete} className={`${row} text-[var(--coral)]`}>
                  <Icon name="trash" size={18} /> Delete post
                </button>
                {rule}
                {notifyRow}
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-1 pb-2">
              <button type="button" onClick={() => applySignal(t, 'interested')} className={`${row} text-[var(--ink)]`}>
                <Icon name="star" size={18} filled={t.viewerAuthorSignal === 'interested'} />
                {t.viewerAuthorSignal === 'interested' ? 'Interested ✓' : 'Interested'}
              </button>
              <button type="button" onClick={() => applySignal(t, 'not_interested')} className={`${row} text-[var(--ink)]`}>
                <Icon name="minus" size={18} />
                {t.viewerAuthorSignal === 'not_interested' ? 'Not interested ✓' : 'Not interested'}
              </button>
              {rule}
              <button type="button" onClick={() => reportPost(t)} className={`${row} text-[var(--ink)]`}>
                <Icon name="shield" size={18} /> Report post
              </button>
              <button type="button" onClick={() => hidePost(t)} className={`${row} text-[var(--ink)]`}>
                <Icon name="eye_off" size={18} /> Hide post (for a day)
              </button>
              {rule}
              {notifyRow}
            </div>
          );
        })()}
      </BottomSheet>

      {/* Report reason picker — opens after tapping "Report post". */}
      <BottomSheet open={!!reportTarget} onClose={() => setReportTarget(null)} title="Report post" subtitle="Why are you reporting this post?">
        <div className="flex flex-col gap-1 pb-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => submitReport(reason)}
              className="w-full flex items-center justify-between gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
            >
              {reason}
              <Icon name="chevron" size={16} className="text-[var(--muted)] shrink-0" />
            </button>
          ))}
        </div>
      </BottomSheet>

      <Toast message={toast.message} show={toast.show} />
    </>
  );
}
