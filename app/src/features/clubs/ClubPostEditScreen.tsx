import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../shared/lib/authStore';
import { getClubPost, editClubPost, apiImageUrl, type ApiClubPost } from '../../shared/lib/api';

interface ClubPostEditScreenProps {
  clubId: string;
  postId: string;
  onBack: () => void;
}

/**
 * Facebook-style dedicated "Edit post" page (reached from a post's ⋯ menu in the
 * club feed or on the single-post permalink) — replaces the old inline textarea so
 * editing happens on its own screen, not in place. Loads the post, guards to its
 * author, edits the body via `PATCH /clubs/:id/posts/:postId`, then `onBack()`s;
 * the feed/permalink remounts and shows the saved text. Photos can't be changed
 * here (the edit endpoint only updates text) — existing attachments are shown for
 * context.
 */
export function ClubPostEditScreen({ clubId, postId, onBack }: ClubPostEditScreenProps) {
  const currentUser = useAuthStore((s) => s.user);

  const [post, setPost] = useState<ApiClubPost | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'forbidden' | 'ready'>('loading');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    getClubPost(clubId, postId)
      .then((p) => {
        if (!alive) return;
        if (!p || p.isDeleted) { setStatus('notfound'); return; }
        if (!currentUser || p.author?.id !== currentUser.id) { setStatus('forbidden'); return; }
        setPost(p);
        setBody(p.body ?? '');
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setStatus(e && /404|not found/i.test(String(e.message)) ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [clubId, postId, currentUser, reloadKey]);

  // Focus the textarea once loaded and drop the caret at the END of the existing
  // text (autoFocus alone leaves it at the first character) so editing continues
  // naturally, Facebook-style.
  useEffect(() => {
    if (status !== 'ready') return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [status]);

  const original = (post?.body ?? '').trim();
  const trimmed = body.trim();
  const canSave = !!trimmed && trimmed !== original && !saving;

  const handleSave = async () => {
    if (!post || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await editClubPost(clubId, post.id, trimmed);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your changes. Please try again.");
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={2} /></div>
      </div>
    );
  }
  if (status === 'notfound') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="groups" title="Post not found" description="This post may have been removed." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'forbidden') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="lock" title="You can't edit this post" description="Only the author can edit a post." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'error' || !post) {
    return <div className="scroll safe-top safe-bottom"><ErrorState title="Couldn't load this post" message="We couldn't fetch the post to edit. Tap to retry." onRetry={() => { setStatus('loading'); setReloadKey((k) => k + 1); }} /></div>;
  }

  const attachments = post.attachments ?? [];

  return (
    <div className="scroll pb-[100px] pt-[calc(8px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} backIcon="back" title="Edit post" />

      <div className="px-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Avatar src={post.author?.avatarUrl} name={post.author?.displayName ?? 'Player'} size={40} variant="blue" />
          <div className="min-w-0">
            <div className="font-semibold text-[15px] text-[var(--ink)] truncate">{post.author?.displayName ?? 'Player'}</div>
            
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={8000}
          placeholder="Share something with the club…"
          className="w-full px-3.5 py-3 rounded-[14px] bg-[var(--surface)] border border-[var(--field-border)] outline-none focus:border-[var(--lime)] text-[var(--ink)] resize-none text-[15px]"
        />

        {attachments.length > 0 && (
          <div className="mt-3">
            <div className="t-eyebrow px-1 mb-1.5">Photos</div>
            {attachments.length === 1 ? (
              <img src={apiImageUrl(attachments[0]?.url)} alt="Post attachment" loading="lazy" className="w-full h-auto max-h-[50vh] object-contain rounded-xl bg-[var(--surface-2)]" />
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {attachments.map((a, i) => (
                  <img key={i} src={apiImageUrl(a.url)} alt="Post attachment" loading="lazy" className="w-full aspect-square object-cover rounded-xl" />
                ))}
              </div>
            )}
            <div className="t-sm mt-1.5 px-1">Photos can't be changed when editing — only the text.</div>
          </div>
        )}

        {error && <div className="mt-3 t-sm text-[var(--coral)] font-bold px-1">{error}</div>}
      </div>

      <div className="app-action-bar">
        <Button fullWidth disabled={!canSave} onClick={handleSave}>
          {saving ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</> : <><Icon name="check" size={18} /> Save changes</>}
        </Button>
      </div>
    </div>
  );
}
