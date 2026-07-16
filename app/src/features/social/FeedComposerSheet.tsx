import { useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import {
  createFeedPost, listGames, listOpenPlaySessions, listClubs,
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

interface PickerRow { refId: string; label: string; sub?: string }

const ATTACH_META: Record<AttachType, { label: string; icon: string }> = {
  game: { label: 'Game', icon: 'sports_tennis' },
  open_play: { label: 'Open Play', icon: 'calendar' },
  club: { label: 'Club', icon: 'groups' },
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
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

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
    setPicking(null);
    setError('');
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const loadPicker = (type: AttachType) => {
    setPicking(type);
    setPickerLoading(true);
    setPickerRows([]);
    const fetchRows: Promise<PickerRow[]> =
      type === 'game'
        ? listGames({ mine: true }).then((gs) =>
            gs.map((g) => ({ refId: g.id, label: g.title || 'Game', sub: [g.whenLabel, g.timeLabel].filter(Boolean).join(' · ') })))
        : type === 'open_play'
          ? listOpenPlaySessions({ pageSize: 30 }).then((ss) =>
              ss.map((s) => ({ refId: s.id, label: s.title, sub: [s.date, s.startTime, s.venueName].filter(Boolean).join(' · ') })))
          : listClubs({ mine: true }).then((p) =>
              p.items.map((c) => ({ refId: c.id, label: c.name, sub: `${c.memberCount} member${c.memberCount === 1 ? '' : 's'}` })));
    fetchRows
      .then((rows) => setPickerRows(rows))
      .catch(() => setPickerRows([]))
      .finally(() => setPickerLoading(false));
  };

  const pick = (row: PickerRow) => {
    if (!picking) return;
    setAttachment({ type: picking, refId: row.refId, label: row.label, sub: row.sub });
    setPicking(null);
  };

  const canPost = (!!draft.trim() || !!attachment || !!repostOf) && !posting;

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    setError('');
    try {
      const post = await createFeedPost({
        body: draft.trim() || undefined,
        attachment: attachment ? { type: attachment.type, refId: attachment.refId } : undefined,
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
      <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-[14px] text-[var(--muted)]">Cancel</button>
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
    <BottomSheet open={open} onClose={onClose} title={title} footer={footer} sheetClassName="md:!max-w-2xl">
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

          {/* Attach row — only in non-repost mode. */}
          {!repostOf && (
            <div className="mt-3 ml-[48px] flex items-center gap-2">
              <span className="t-sm mr-1">Share:</span>
              {(Object.keys(ATTACH_META) as AttachType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => loadPicker(t)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px] font-bold text-[var(--ink)] active:bg-[var(--surface-2)]"
                >
                  <Icon name={ATTACH_META[t].icon} size={14} />
                  {ATTACH_META[t].label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-[13px] text-[var(--coral)]">{error}</p>}
        </div>
      )}
    </BottomSheet>
  );
}
