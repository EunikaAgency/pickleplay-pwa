import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Toast } from '../../shared/components/ui/Toast';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import {
  getFeedPost, listFeedReplies, createFeedPost, reactFeedPost, unreactFeedPost, editFeedPost, deleteFeedPost,
  type ApiFeedPost, type FeedSharedPost,
} from '../../shared/lib/api';
import { FeedShareCard } from './FeedShareCard';
import { RepostQuote } from './RepostQuote';
import { relTime, linkifyBody } from './feedTime';
import { FeedComposerSheet } from './FeedComposerSheet';

interface FeedPostScreenProps {
  postId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/** A post or one of its comments (the action-sheet / delete target). */
type Target = { post: ApiFeedPost; isComment: boolean };

/**
 * PickleFeed single-post permalink (opened by tapping a post): the full post +
 * every comment + a sticky comment composer. Mirrors the club post permalink,
 * but on the global feed — with the same like / edit / delete / repost model.
 */
export function FeedPostScreen({ postId, onNavigate, onBack }: FeedPostScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [post, setPost] = useState<ApiFeedPost | null>(null);
  const [replies, setReplies] = useState<ApiFeedPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [actionTarget, setActionTarget] = useState<Target | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [repostTarget, setRepostTarget] = useState<FeedSharedPost | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [reloadKey, setReloadKey] = useState(0);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  useEffect(() => {
    let alive = true;
    getFeedPost(postId)
      .then(async (p) => {
        if (!alive) return;
        setPost(p);
        setStatus('ready');
        const r = await listFeedReplies(postId).catch(() => [] as ApiFeedPost[]);
        if (!alive) return;
        setReplies([...r].reverse()); // API is newest-first; show oldest-first
      })
      .catch((e) => {
        if (!alive) return;
        setStatus(e && /404|not found/i.test(String(e.message)) ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [postId, reloadKey]);

  const isMine = (p: ApiFeedPost) => !!currentUser && p.author?.id === currentUser.id;
  const canActOn = (p: ApiFeedPost) => !p.isDeleted && isMine(p);

  const toggleReact = async () => {
    if (!post) return;
    if (!isLoggedIn) { onNavigate('login'); return; }
    const liked = post.viewerReacted;
    setPost((p) => (p ? { ...p, viewerReacted: !liked, reactionCount: p.reactionCount + (liked ? -1 : 1) } : p));
    try {
      if (liked) await unreactFeedPost(post.id);
      else await reactFeedPost(post.id);
    } catch {
      setPost((p) => (p ? { ...p, viewerReacted: liked, reactionCount: p.reactionCount + (liked ? 1 : -1) } : p));
    }
  };

  const share = async () => {
    if (!post) return;
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'PickleBallers', text: post.body?.slice(0, 120) || 'Check out this post', url });
      else { await navigator.clipboard.writeText(url); showToast('Link copied'); }
    } catch { /* dismissed */ }
  };

  const submitComment = async () => {
    if (!post || !draft.trim() || posting) return;
    if (!isLoggedIn) { onNavigate('login'); return; }
    setPosting(true);
    try {
      const reply = await createFeedPost({ body: draft.trim(), parentPostId: post.id });
      setReplies((r) => [...r, reply]);
      setPost((p) => (p ? { ...p, replyCount: p.replyCount + 1 } : p));
      setDraft('');
    } catch {
      showToast("Couldn't post your comment");
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (p: ApiFeedPost) => { setActionTarget(null); setEditingId(p.id); setEditDraft(p.body ?? ''); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(''); };
  const saveEdit = async (target: Target) => {
    if (editSaving) return;
    const body = editDraft.trim();
    if (!body) return;
    setEditSaving(true);
    try {
      const updated = await editFeedPost(target.post.id, body);
      if (target.isComment) setReplies((r) => r.map((x) => (x.id === target.post.id ? { ...x, body: updated.body } : x)));
      else setPost((p) => (p ? { ...p, body: updated.body } : p));
      cancelEdit();
    } catch {
      showToast("Couldn't save your edit");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteFeedPost(deleteTarget.post.id);
      if (deleteTarget.isComment) {
        setReplies((r) => r.map((x) => (x.id === deleteTarget.post.id ? { ...x, isDeleted: true, body: null } : x)));
        setPost((p) => (p ? { ...p, replyCount: Math.max(0, p.replyCount - 1) } : p));
        setDeleteTarget(null);
      } else {
        onBack(); // the whole post is gone — leave the permalink
      }
    } catch {
      setDeleteTarget(null);
      showToast("Couldn't delete");
    } finally {
      setDeleting(false);
    }
  };

  const retry = () => { setStatus('loading'); setReloadKey((k) => k + 1); };

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (status === 'notfound') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="message" title="Post not found" description="This post may have been removed." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'error' || !post) {
    return <div className="scroll safe-top safe-bottom"><ErrorState title="Couldn't load this post" message="We couldn't fetch the post. Tap to retry." onRetry={retry} /></div>;
  }

  const renderBody = (p: ApiFeedPost, isComment: boolean) => (
    <>
      {editingId === p.id ? (
        <div className={`${isComment ? 'mt-1.5' : 'mt-2.5'} flex flex-col gap-2`}>
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={isComment ? 2 : 3}
            maxLength={8000}
            className="w-full px-3.5 py-2.5 rounded-[14px] bg-[var(--surface)] border border-[var(--field-border)] outline-none focus:border-[var(--lime)] text-[var(--ink)] resize-none text-[14px]"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={cancelEdit} disabled={editSaving} className="px-3 py-1.5 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-bold text-[12px] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => saveEdit({ post: p, isComment })} disabled={!editDraft.trim() || editSaving} className="px-3 py-1.5 rounded-lg bg-[var(--lime)] text-[var(--lime-ink)] font-bold text-[12px] disabled:opacity-50">{editSaving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <p className={`${isComment ? 'text-[14px]' : 'mt-2.5'} whitespace-pre-wrap break-words`}>{p.isDeleted ? <em className="text-[var(--muted)]">deleted</em> : linkifyBody(p.body ?? '')}</p>
      )}
      {!p.isDeleted && p.attachments?.[0] && <FeedShareCard attachment={p.attachments[0]} onNavigate={onNavigate} compact={isComment} />}
      {!p.isDeleted && p.sharedPost && <RepostQuote shared={p.sharedPost} onNavigate={onNavigate} />}
    </>
  );

  const actionsBtn = (p: ApiFeedPost, isComment: boolean) =>
    canActOn(p) && editingId !== p.id ? (
      <button
        type="button"
        onClick={() => setActionTarget({ post: p, isComment })}
        aria-label={isComment ? 'Comment options' : 'Post options'}
        className={`ml-auto shrink-0 ${isComment ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center text-[var(--muted)] active:bg-[var(--surface-2)]`}
      >
        <Icon name="more" size={isComment ? 16 : 18} />
      </button>
    ) : null;

  return (
    <div className="scroll feed-post-scroll pb-[96px] pt-[calc(8px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} backIcon="back" title="Post" />

      <div className="px-4 flex flex-col gap-3">
        {/* The post */}
        <div className="about-card m-0!">
          <div className="flex items-center gap-2.5">
            <Avatar src={post.author?.avatarUrl} name={post.author?.displayName ?? 'Player'} size={40} variant="blue" />
            <div className="min-w-0">
              <div className="font-semibold text-[15px] text-[var(--ink)] truncate">{post.author?.displayName ?? 'Player'}</div>
              <div className="t-sm">{relTime(post.createdAt)}</div>
            </div>
            {actionsBtn(post, false)}
          </div>
          {renderBody(post, false)}
          <div className="mt-3 flex items-center gap-5 t-sm">
            <button
              onClick={toggleReact}
              aria-pressed={post.viewerReacted}
              aria-label={post.viewerReacted ? 'Unlike this post' : 'Like this post'}
              className={`inline-flex items-center gap-1.5 font-bold ${post.viewerReacted ? 'text-[var(--coral)]' : 'text-[var(--muted)]'}`}
            >
              <Icon name={post.viewerReacted ? 'heart' : 'heart_o'} size={18} />
              {post.reactionCount > 0 ? post.reactionCount : 'Like'}
            </button>
            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
              <Icon name="message" size={18} />
              {post.replyCount > 0 ? `${post.replyCount} comment${post.replyCount === 1 ? '' : 's'}` : 'No comments'}
            </span>
            {!post.isDeleted && (
              <button onClick={() => { if (!isLoggedIn) { onNavigate('login'); return; } setRepostTarget({ id: post.id, author: post.author, authorId: post.authorId, body: post.body, attachments: post.attachments, isDeleted: post.isDeleted, createdAt: post.createdAt }); }} aria-label="Repost" className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
                <Icon name="repeat" size={18} /> Repost
              </button>
            )}
            <button onClick={share} aria-label="Share" className="ml-auto inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
              <Icon name="share" size={18} />
            </button>
          </div>
        </div>

        <hr className="border-t-2 border-[var(--border)] mx-0 my-3" />
        {/* Comments */}
        <div className="t-eyebrow px-1">Comments</div>
        {replies.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No comments yet{isLoggedIn ? ' — start the conversation.' : '.'}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-2.5">
                <Avatar src={r.author?.avatarUrl} name={r.author?.displayName ?? 'Player'} size={32} variant="blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13px] text-[var(--ink)] truncate">{r.author?.displayName ?? 'Player'}</span>
                    <span className="t-sm">{relTime(r.createdAt)}</span>
                    {actionsBtn(r, true)}
                  </div>
                  {renderBody(r, true)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky comment composer */}
      {isLoggedIn ? (
        <div className="sticky bottom-0 z-40 w-full bg-[var(--bg)] border-t border-[var(--border)] px-4 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment…"
              rows={1}
              maxLength={8000}
              className="flex-1 px-3.5 py-2.5 rounded-[14px] bg-[var(--surface)] border border-[var(--field-border)] outline-none focus:border-[var(--lime)] text-[var(--ink)] resize-none"
            />
            <button
              aria-label="Post comment"
              onClick={submitComment}
              disabled={!draft.trim() || posting}
              className="w-11 h-11 shrink-0 rounded-[14px] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center disabled:opacity-50"
            >
              <Icon name={posting ? 'spinner' : 'send'} size={18} className={posting ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 z-40 w-full bg-[var(--bg)] border-t border-[var(--border)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] t-sm text-center">
          <button className="font-bold text-[var(--ink)]" onClick={() => onNavigate('login')}>Sign in to comment</button>
        </div>
      )}

      <Toast message={toast.message} show={toast.show} />

      {/* Edit/delete action sheet */}
      <BottomSheet open={!!actionTarget} onClose={() => setActionTarget(null)} title={actionTarget?.isComment ? 'Comment' : 'Post'}>
        {actionTarget && (
          <div className="flex flex-col gap-1 pb-2">
            <button type="button" onClick={() => startEdit(actionTarget.post)} className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl">
              <Icon name="edit" size={18} /> Edit {actionTarget.isComment ? 'comment' : 'post'}
            </button>
            <button type="button" onClick={() => { const t = actionTarget; setActionTarget(null); setDeleteTarget(t); }} className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)] rounded-xl">
              <Icon name="trash" size={18} /> Delete {actionTarget.isComment ? 'comment' : 'post'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Repost composer */}
      <FeedComposerSheet
        open={!!repostTarget}
        onClose={() => setRepostTarget(null)}
        onPosted={() => { setRepostTarget(null); showToast('Reposted'); }}
        repostOf={repostTarget}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={() => { if (!deleting) setDeleteTarget(null); }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[340px] rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <div className="font-heading font-bold text-[17px] text-[var(--ink)]">Delete this {deleteTarget.isComment ? 'comment' : 'post'}?</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5">This removes it for everyone. This can’t be undone.</div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 h-11 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[14px] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="flex-1 h-11 rounded-xl bg-[var(--coral)] text-white font-heading font-semibold text-[14px] flex items-center justify-center gap-1 disabled:opacity-50">
                {deleting ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={15} /></span> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
