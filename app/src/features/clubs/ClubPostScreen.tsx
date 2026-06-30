import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { GameShareCard } from '../../shared/components/ui/GameShareCard';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Toast } from '../../shared/components/ui/Toast';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  getClub, getClubPost, listClubReplies, createClubPost, reactClubPost, unreactClubPost, editClubPost, deleteClubPost,
  apiUrl, apiImageUrl, getAccessToken,
  type ApiClub, type ApiClubPost, type ClubAttachment,
} from '../../shared/lib/api';

interface ClubPostScreenProps {
  clubId: string;
  postId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/** "2h" / "3d" / "Jun 8" from an ISO string. */
function relTime(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A post or one of its comments (the action-sheet / delete target). */
type Target = { post: ApiClubPost; isComment: boolean };

/**
 * Facebook-style single-post permalink (opened by tapping a post in the club
 * feed): the full post + every comment + a sticky composer. Reuses the same club
 * post client as the feed; mirrors its like / edit / delete / attachment-viewer
 * behaviour but on a dedicated screen.
 */
export function ClubPostScreen({ clubId, postId, onNavigate, onBack }: ClubPostScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [club, setClub] = useState<ApiClub | null>(null);
  const [post, setPost] = useState<ApiClubPost | null>(null);
  const [replies, setReplies] = useState<ApiClubPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [actionTarget, setActionTarget] = useState<Target | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [reloadKey, setReloadKey] = useState(0);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  useEffect(() => {
    let alive = true;
    // `status` starts 'loading'; retry() re-sets it before bumping reloadKey.
    getClubPost(clubId, postId)
      .then(async (p) => {
        if (!alive) return;
        setPost(p);
        setStatus('ready');
        const [c, r] = await Promise.all([
          getClub(clubId).catch(() => null),
          listClubReplies(clubId, postId).catch(() => [] as ApiClubPost[]),
        ]);
        if (!alive) return;
        setClub(c);
        setReplies([...r].reverse()); // API is newest-first; show oldest-first
      })
      .catch((e) => {
        if (!alive) return;
        setStatus(e && /404|not found/i.test(String(e.message)) ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [clubId, postId, reloadKey]);

  // Live: refresh the post + comments while open (others' comments/likes appear).
  useEffect(() => {
    if (status !== 'ready') return;
    const token = getAccessToken();
    if (!token) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource(apiUrl(`/api/v1/clubs/${clubId}/stream?token=${encodeURIComponent(token)}`));
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (closed) return;
        getClubPost(clubId, postId).then((p) => { if (!closed) setPost(p); }).catch(() => {});
        listClubReplies(clubId, postId).then((r) => { if (!closed) setReplies([...r].reverse()); }).catch(() => {});
      }, 350);
    };
    for (const ev of ['post.created', 'post.updated', 'post.deleted', 'reaction.changed']) es.addEventListener(ev, reload);
    return () => { closed = true; if (timer) clearTimeout(timer); es.close(); };
  }, [clubId, postId, status]);

  const canComment = !!club?.isMember && userHasPermission(currentUser, 'player.clubs.post');
  const canReact = isLoggedIn && userHasPermission(currentUser, 'player.clubs.react');
  const isMine = (p: ApiClubPost) => !!currentUser && p.author?.id === currentUser.id;
  const canEdit = (p: ApiClubPost) => isMine(p);
  const canDelete = (p: ApiClubPost) => isMine(p) || !!club?.isHost;
  const canActOn = (p: ApiClubPost) => !p.isDeleted && (canEdit(p) || canDelete(p));

  const toggleReact = async () => {
    if (!post || !canReact) return;
    const liked = post.viewerReacted;
    setPost((p) => (p ? { ...p, viewerReacted: !liked, reactionCount: p.reactionCount + (liked ? -1 : 1) } : p));
    try {
      if (liked) await unreactClubPost(clubId, post.id);
      else await reactClubPost(clubId, post.id);
    } catch {
      setPost((p) => (p ? { ...p, viewerReacted: liked, reactionCount: p.reactionCount + (liked ? 1 : -1) } : p));
    }
  };

  const submitComment = async () => {
    if (!post || !draft.trim() || posting) return;
    setPosting(true);
    try {
      const reply = await createClubPost(clubId, draft.trim(), post.id);
      setReplies((r) => [...r, reply]);
      setPost((p) => (p ? { ...p, replyCount: p.replyCount + 1 } : p));
      setDraft('');
    } catch {
      showToast("Couldn't post your comment");
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (p: ApiClubPost) => { setActionTarget(null); setEditingId(p.id); setEditDraft(p.body ?? ''); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(''); };
  const saveEdit = async (target: Target) => {
    if (editSaving) return;
    const body = editDraft.trim();
    if (!body) return;
    setEditSaving(true);
    try {
      const updated = await editClubPost(clubId, target.post.id, body);
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
      await deleteClubPost(clubId, deleteTarget.post.id);
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
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="groups" title="Post not found" description="This post may have been removed." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'error' || !post) {
    return <div className="scroll safe-top safe-bottom"><ErrorState title="Couldn't load this post" message="We couldn't fetch the post. Tap to retry." onRetry={retry} /></div>;
  }

  // Render one post/comment's body (with the inline editor when it's being edited)
  // + its attachments.
  const renderBody = (p: ApiClubPost, isComment: boolean) => (
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
        <p className={`${isComment ? 'text-[14px]' : 'mt-2.5'} whitespace-pre-wrap break-words`}>{p.isDeleted ? <em className="text-[var(--muted)]">deleted</em> : p.body}</p>
      )}
      {/* Rich game share cards (Facebook-style link previews). */}
      {!p.isDeleted && p.attachments?.filter((a): a is ClubAttachment & { type: 'game_link' } => a.type === 'game_link').map((a) => (
        <GameShareCard key={a.gameId} attachment={a} onNavigate={onNavigate} />
      ))}

      {/* Photo / GIF attachments (filtered to non-game_link). */}
      {!p.isDeleted && (() => {
        const photos = p.attachments?.filter((a) => a.type !== 'game_link') ?? [];
        if (photos.length === 0) return null;
        return photos.length === 1 ? (
          <button type="button" onClick={() => setLightbox(apiImageUrl(photos[0].url))} className={`block w-full ${isComment ? 'mt-1.5' : 'mt-2.5'}`}>
            <img src={apiImageUrl(photos[0].url)} alt="Attachment" loading="lazy" className={`w-full h-auto ${isComment ? 'max-h-[60vh] rounded-lg' : 'max-h-[75vh] rounded-xl'} object-contain bg-[var(--surface-2)]`} />
          </button>
        ) : (
          <div className={`${isComment ? 'mt-1.5' : 'mt-2.5'} grid grid-cols-2 gap-1.5`}>
            {photos.map((a, i) => (
              <button key={i} type="button" onClick={() => setLightbox(apiImageUrl(a.url))} className="block">
                <img src={apiImageUrl(a.url)} alt="Attachment" loading="lazy" className={`w-full aspect-square object-cover ${isComment ? 'rounded-lg' : 'rounded-xl'}`} />
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );

  const actionsBtn = (p: ApiClubPost, isComment: boolean) =>
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
    <div className="scroll pb-[96px] pt-[calc(8px+env(safe-area-inset-top))]">
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
          <div className="mt-3 flex items-center gap-4 t-sm">
            <button
              onClick={toggleReact}
              disabled={!canReact}
              aria-pressed={post.viewerReacted}
              aria-label={post.viewerReacted ? 'Unlike this post' : 'Like this post'}
              className={`inline-flex items-center gap-1.5 font-bold ${post.viewerReacted ? 'text-[var(--coral)]' : 'text-[var(--muted)]'} disabled:opacity-60`}
            >
              <Icon name={post.viewerReacted ? 'heart' : 'heart_o'} size={18} />
              {post.reactionCount > 0 ? post.reactionCount : 'Like'}
            </button>
            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]">
              <Icon name="message" size={18} />
              {post.replyCount > 0 ? `${post.replyCount} comment${post.replyCount === 1 ? '' : 's'}` : 'No comments'}
            </span>
          </div>
        </div>

        {/* Comments */}
        <div className="t-eyebrow px-1">Comments</div>
        {replies.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No comments yet{canComment ? ' — start the conversation.' : '.'}</div>
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
      {canComment ? (
        <div className="fixed left-0 right-0 bottom-0 z-40 max-w-[480px] mx-auto bg-[var(--bg)] border-t-[0.5px] border-[var(--hairline)] px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
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
        !club?.isMember && <div className="fixed left-0 right-0 bottom-0 z-40 max-w-[480px] mx-auto bg-[var(--bg)] border-t-[0.5px] border-[var(--hairline)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] t-sm text-center">Join this club to comment.</div>
      )}

      <Toast message={toast.message} show={toast.show} />

      {/* Edit/delete action sheet */}
      <BottomSheet open={!!actionTarget} onClose={() => setActionTarget(null)} title={actionTarget?.isComment ? 'Comment' : 'Post'}>
        {actionTarget && (
          <div className="flex flex-col gap-1 pb-2">
            {canEdit(actionTarget.post) && (
              <button
                type="button"
                onClick={() => {
                  // Comments edit inline; a post opens the dedicated edit page (Facebook-style).
                  if (actionTarget.isComment) { startEdit(actionTarget.post); return; }
                  const t = actionTarget;
                  setActionTarget(null);
                  onNavigate('club-post-edit', { id: clubId, postId: t.post.id });
                }}
                className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
              >
                <Icon name="edit" size={18} /> Edit {actionTarget.isComment ? 'comment' : 'post'}
              </button>
            )}
            <button type="button" onClick={() => { const t = actionTarget; setActionTarget(null); setDeleteTarget(t); }} className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)] rounded-xl">
              <Icon name="close" size={18} /> Delete {actionTarget.isComment ? 'comment' : 'post'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Full-screen image viewer */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" aria-label="Close" onClick={() => setLightbox(null)} className="absolute top-[calc(12px+env(safe-area-inset-top))] right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">
            <Icon name="close" size={18} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

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
