import { useRef, useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import {
  createFeedPost, uploadFeedMedia, apiImageUrl, listGames, listOpenPlaySessions, listClubs,
  type ApiFeedPost, type FeedSharedPost,
} from '../../shared/lib/api';
import { linkifyBody } from './feedTime';

type AttachType = 'game' | 'open_play' | 'club';
interface PickedAttachment { type: AttachType; refId: string; label: string; sub?: string }

interface FeedComposerSheetProps {
  open: boolean;
  onClose: () => void;
  /** New post created → prepend it to the feed. */
  onPosted: (post: ApiFeedPost) => void;
  /** Prefill a share card (from a "Share to feed" entry point on a detail screen). */
  prefill?: PickedAttachment;
  /** Repost mode — quote this post; the composer adds an optional caption. */
  repostOf?: FeedSharedPost | null;
}

interface PickerRow { refId: string; label: string; sub?: string; createdAt?: string | null }

// `label` is singular (used in the picker title "Pick a Game" + the selected
// share-card subtitle); `chip` is the plural Share-row button label.
const ATTACH_META: Record<AttachType, { label: string; chip: string; icon: string }> = {
  game: { label: 'Game', chip: 'Games', icon: 'sports_tennis' },
  open_play: { label: 'Open Play', chip: 'Open Play', icon: 'calendar' },
  club: { label: 'Club', chip: 'Clubs', icon: 'groups' },
};

/**
 * The compose popup — opens when the player taps "What's new?" (or a "Share to
 * feed" button). A text box plus an Attach row to pin a Game, Open Play session,
 * or Club as a share card. In repost mode it shows the quoted post + a caption.
 */
export function FeedComposerSheet({ open, onClose, onPosted, prefill, repostOf }: FeedComposerSheetProps) {
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [photos, setPhotos] = useState<{ type: 'image'; url: string; caption: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  // Shown when the user tries to close with unsaved input — "discard?".
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Attachment picker state (a sub-view within the same sheet).
  const [picking, setPicking] = useState<AttachType | null>(null);
  const [pickerRows, setPickerRows] = useState<PickerRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Reset when the sheet transitions closed → open (prefill seeds the
  // attachment). Render-phase adjustment on a prop change — the React-endorsed
  // alternative to a reset effect (see react.dev "You Might Not Need an Effect").
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setDraft('');
    setAttachment(prefill ?? null);
    setPhotos([]);
    setPicking(null);
    setError('');
    setConfirmDiscard(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Has the user entered anything they'd lose on close? (A prefilled share card
  // or a repost quote isn't "their input" — only what they added counts.)
  const isDirty = !!draft.trim() || photos.length > 0 || (!prefill && !repostOf && !!attachment);

  // Guard every close path (X, backdrop, Escape, Cancel): confirm first if dirty.
  const requestClose = () => {
    if (isDirty) { setConfirmDiscard(true); return; }
    onClose();
  };
  const discardAndClose = () => {
    setConfirmDiscard(false);
    onClose();
  };

  // Posts are photo-only (GIFs are a comments-only thing). The file input's
  // accept list omits image/gif so the picker won't even surface GIFs.
  // Multiple files can be picked at once — uploaded sequentially, capped at 4.
  const pickPhotos = async (files: FileList | null) => {
    if (!files || !files.length || uploadingPhoto) return;
    const room = 4 - photos.length;
    if (room <= 0) { setError('Up to 4 photos'); return; }
    const chosen = Array.from(files).slice(0, room);
    setError(chosen.length < files.length ? 'Up to 4 photos' : '');
    setUploadingPhoto(true);
    try {
      for (const file of chosen) {
        const url = await uploadFeedMedia(file);
        if (url) setPhotos((p) => [...p, { type: 'image', url, caption: '' }]);
      }
    } catch {
      setError("Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const loadPicker = (type: AttachType) => {
    setPicking(type);
    setPickerLoading(true);
    setPickerRows([]);
    // Browse everything shareable — any game/session/club, not just the user's
    // own (you can share something someone else created or booked).
    const fetchRows: Promise<PickerRow[]> =
      type === 'game'
        ? listGames({ status: 'published' }).then((gs) =>
            gs.map((g) => ({ refId: g.id, label: g.title || 'Game', sub: [g.whenLabel, g.timeLabel].filter(Boolean).join(' · '), createdAt: g.createdAt })))
        : type === 'open_play'
          ? listOpenPlaySessions({ pageSize: 30 }).then((ss) =>
              ss.map((s) => ({ refId: s.id, label: s.title, sub: [s.date, s.startTime, s.venueName].filter(Boolean).join(' · '), createdAt: s.createdAt })))
          : listClubs({ pageSize: 30 }).then((p) =>
              p.items.map((c) => ({ refId: c.id, label: c.name, sub: `${c.memberCount} member${c.memberCount === 1 ? '' : 's'}`, createdAt: c.createdAt })));
    fetchRows
      // Suggest the most recently created first (server sort varies by feed —
      // games/sessions come date-ascending — so normalise it here).
      .then((rows) => setPickerRows([...rows].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))))
      .catch(() => setPickerRows([]))
      .finally(() => setPickerLoading(false));
  };

  const pick = (row: PickerRow) => {
    if (!picking) return;
    setAttachment({ type: picking, refId: row.refId, label: row.label, sub: row.sub });
    setPicking(null);
  };

  const canPost = (!!draft.trim() || !!attachment || photos.length > 0 || !!repostOf) && !posting && !uploadingPhoto;

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    setError('');
    try {
      const post = await createFeedPost({
        body: draft.trim() || undefined,
        attachment: attachment ? { type: attachment.type, refId: attachment.refId } : undefined,
        media: photos.length ? photos.map((p) => ({ type: p.type, url: p.url, caption: p.caption.trim() || undefined })) : undefined,
        sharedPostId: repostOf?.id,
      });
      onPosted(post);
      onClose();
    } catch {
      setError("Couldn't post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const title = repostOf ? 'Repost' : picking ? `Pick a ${ATTACH_META[picking].label}` : 'New post';

  const footer = picking ? null : (
    <div className="flex items-center justify-between gap-3 px-1">
      <button type="button" onClick={requestClose} className="px-4 py-2.5 rounded-xl font-bold text-[14px] text-[var(--muted)]">Cancel</button>
      <button
        type="button"
        onClick={submit}
        disabled={!canPost}
        className="px-6 py-2.5 rounded-xl font-bold text-[14px] bg-[var(--lime)] text-[var(--ink)] disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {posting && <Icon name="spinner" size={15} className="animate-spin" />}
        Post
      </button>
    </div>
  );

  return (
    <BottomSheet open={open} onClose={requestClose} title={title} footer={footer} sheetClassName="md:!max-w-2xl">
      {picking ? (
        /* ── Attachment picker sub-view ── */
        <div className="px-5 pb-2">
          <button type="button" onClick={() => setPicking(null)} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--muted)]">
            <Icon name="back" size={16} /> Back
          </button>
          {pickerLoading ? (
            <div className="py-8 text-center t-sm">Loading…</div>
          ) : pickerRows.length === 0 ? (
            <div className="py-8 text-center t-sm">Nothing to share here yet.</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
              {pickerRows.map((row) => (
                <button
                  key={row.refId}
                  type="button"
                  onClick={() => pick(row)}
                  className="w-full text-left px-3 py-3 rounded-xl active:bg-[var(--surface-2)]"
                >
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{row.label}</div>
                  {row.sub && <div className="t-sm truncate">{row.sub}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Compose view ── */
         <div className="px-5">
          <div className="flex items-start gap-2.5">
            <Avatar src={user?.avatarUrl} name={user?.displayName ?? 'You'} size={38} variant="blue" />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                // Catch pasted/keyboard-inserted images. Posts are photo-only, so a
                // pasted GIF is rejected with a hint (it belongs on comments).
                const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
                if (!files.length || repostOf) return;
                e.preventDefault();
                files.forEach((f) => {
                  if (f.type === 'image/gif') setError('GIFs can only be added to comments, not posts.');
                  else void pickPhoto(f);
                });
              }}
              placeholder="What's new?"
              rows={4}
              maxLength={8000}
              autoFocus
              className="flex-1 px-1 py-1.5 bg-transparent outline-none text-[var(--ink)] resize-none text-[15px] placeholder:text-[var(--muted)]"
            />
          </div>

          {/* Repost quote (repost mode). */}
          {repostOf && (
            <div className="mt-1 ml-[48px] rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center gap-2">
                <Avatar src={repostOf.author?.avatarUrl} name={repostOf.author?.displayName ?? 'Player'} size={22} variant="blue" />
                <span className="font-semibold text-[13px] text-[var(--ink)] truncate">{repostOf.author?.displayName ?? 'Player'}</span>
              </div>
              {repostOf.body && <p className="mt-1.5 text-[13px] text-[var(--muted)] whitespace-pre-wrap break-words line-clamp-3">{linkifyBody(repostOf.body)}</p>}
            </div>
          )}

          {/* Selected share card preview. */}
          {attachment && !repostOf && (
            <div className="mt-2 ml-[48px] flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
              <Icon name={ATTACH_META[attachment.type].icon} size={18} className="text-[var(--muted)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13px] text-[var(--ink)] truncate">{attachment.label}</div>
                <div className="t-sm">{ATTACH_META[attachment.type].label}{attachment.sub ? ` · ${attachment.sub}` : ''}</div>
              </div>
              <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)} className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted)] active:bg-[var(--surface-3)]">
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {/* Staged photo previews (posts are photo-only — no GIFs). Each photo
              is full-width with its own optional caption. */}
          {photos.length > 0 && !repostOf && (
            <div className="mt-3 flex flex-col gap-3">
              {photos.map((p, i) => (
                <div key={`${p.url}-${i}`} className="w-full overflow-hidden border border-[var(--border)]">
                  <div className="relative w-full">
                    <img src={apiImageUrl(p.url)} alt="Photo" className="w-full max-h-80 object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setPhotos((ph) => ph.filter((_, j) => j !== i))}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={p.caption}
                    onChange={(e) => setPhotos((ph) => ph.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                    placeholder="Add a caption…"
                    maxLength={200}
                    className="w-full px-3 py-2.5 bg-transparent outline-none text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] border-t border-[var(--border)]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Attach row — only in non-repost mode. */}
          {!repostOf && (
            <div className="mt-3">
              <span className="t-sm">Share:</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(Object.keys(ATTACH_META) as AttachType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => loadPicker(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px] font-bold text-[var(--ink)] active:bg-[var(--surface-2)]"
                  >
                    <Icon name={ATTACH_META[t].icon} size={14} />
                    {ATTACH_META[t].chip}
                  </button>
                ))}
              </div>
              {/* Photo upload (posts: photos only, GIFs excluded via accept). */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                multiple
                hidden
                onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ''; }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto || photos.length >= 4}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-[12px] font-bold text-[var(--ink)] active:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Icon name={uploadingPhoto ? 'spinner' : 'camera'} size={14} className={uploadingPhoto ? 'animate-spin' : ''} />
                {uploadingPhoto ? 'Uploading…' : photos.length ? 'Add more' : 'Add photo'}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-[13px] text-[var(--coral)]">{error}</p>}
        </div>
      )}

      {/* Discard confirmation — sits above the sheet (z 1501). "Keep editing"
          leaves the composer untouched; "Discard" closes + drops the input. */}
      {confirmDiscard && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 1600 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-title"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDiscard(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[320px] rounded-2xl bg-[var(--bg)] p-5 shadow-xl">
            <h3 id="discard-title" className="font-bold text-[16px] text-[var(--ink)]">Discard {repostOf ? 'repost' : 'post'}?</h3>
            <p className="mt-1.5 text-[13px] text-[var(--muted)]">Your text and photos won't be saved.</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-[14px] text-[var(--ink)] active:bg-[var(--surface-2)]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={discardAndClose}
                className="px-4 py-2.5 rounded-xl font-bold text-[14px] bg-[var(--coral)] text-white active:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
