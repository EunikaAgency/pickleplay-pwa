import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Toast } from './Toast';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useAuthStore } from '../../lib/authStore';
import { userHasPermission } from '../../lib/permissions';
import { listClubs, createClubPost, type ApiClub } from '../../lib/api';
import type { Navigate } from '../../lib/navigation';

interface ShareLobbySheetProps {
  open: boolean;
  onClose: () => void;
  /** The game/lobby to share — the deep link is `…/games/<gameId>`. */
  gameId: string;
  /** Headline for the share text + sheet (e.g. the game title). */
  title: string;
  /** Optional detail line woven into the post (e.g. "Sat 3:00 PM · The Dink Lab · 2 spots left"). */
  subtitle?: string;
  /** Lets the empty-state CTA jump to the Clubs tab; optional. */
  onNavigate?: Navigate;
}

/**
 * A reusable "share this lobby" chooser used by both the home commitment banner
 * and the game-details screen. Two phases:
 *   1. choose — Copy link (native share / clipboard) OR Share to a club
 *   2. clubs  — pick one of the player's clubs; posts a text feed post with the
 *               game details + the lobby link via createClubPost (no API change).
 * Share-to-club is gated client-side on `player.clubs.post` (server is the real
 * authority); guests/ineligible users still get Copy link.
 */
export function ShareLobbySheet({ open, onClose, gameId, title, subtitle, onNavigate }: ShareLobbySheetProps) {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const canShareToClub = isLoggedIn && userHasPermission(user, 'player.clubs.post');

  const [mode, setMode] = useState<'choose' | 'clubs'>('choose');
  const [clubs, setClubs] = useState<ApiClub[] | null>(null);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [clubsError, setClubsError] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const url = typeof window !== 'undefined' ? `${window.location.origin}/games/${gameId}` : `/games/${gameId}`;
  const body = [`🎾 ${title}`, subtitle, `Join: ${url}`].filter(Boolean).join('\n');

  // Reset to the chooser whenever the sheet (re)opens — adjusted during render on
  // the open→true transition (React's recommended alternative to an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMode('choose');
  }

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  // Copy link / native share — mirrors the club invite share.
  const copyLink = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: subtitle ? `${title} — ${subtitle}` : title, url });
        onClose();
      } catch {
        /* user dismissed the share sheet — leave the sheet open */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
    onClose();
    showToast('Game link copied');
  };

  const goToClubs = () => {
    setMode('clubs');
    if (clubs || loadingClubs) return; // already loaded / loading
    setLoadingClubs(true);
    setClubsError(false);
    listClubs({ mine: true })
      .then((page) => setClubs(page.items))
      .catch(() => setClubsError(true))
      .finally(() => setLoadingClubs(false));
  };

  const shareToClub = async (club: ApiClub) => {
    if (postingId) return;
    setPostingId(club.id);
    try {
      await createClubPost(club.id, body);
      onClose();
      showToast(`Shared to ${club.name}`);
    } catch {
      showToast("Couldn't share to that club");
    } finally {
      setPostingId(null);
    }
  };

  const rowClass =
    'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left bg-[var(--surface-2)] active:opacity-80 disabled:opacity-50';

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={mode === 'choose' ? 'Share this game' : 'Share to a club'}
        subtitle={mode === 'choose' ? title : undefined}
      >
        {mode === 'choose' ? (
          <div className="px-1 pb-2 flex flex-col gap-2.5">
            <button type="button" onClick={copyLink} className={rowClass}>
              <span className="shrink-0 text-[var(--primary)]"><Icon name="globe" size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[var(--ink)]">Copy link</span>
                <span className="block text-[12px] text-[var(--muted)] truncate">Share a link to this lobby</span>
              </span>
            </button>
            {canShareToClub && (
              <button type="button" onClick={goToClubs} className={rowClass}>
                <span className="shrink-0 text-[var(--primary)]"><Icon name="groups" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[var(--ink)]">Share to a club</span>
                  <span className="block text-[12px] text-[var(--muted)] truncate">Post this lobby in one of your clubs</span>
                </span>
                <span className="shrink-0 text-[var(--muted)]"><Icon name="forward" size={16} /></span>
              </button>
            )}
          </div>
        ) : (
          <div className="px-1 pb-2">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--muted)] mb-3 active:opacity-70"
            >
              <Icon name="back" size={16} /> Back
            </button>

            {/* Read-only preview of what gets posted. */}
            <div className="rounded-2xl bg-[var(--surface-2)] px-3.5 py-3 mb-3 text-[13px] text-[var(--ink)] whitespace-pre-line leading-snug">
              {body}
            </div>

            {loadingClubs ? (
              <LoadingSkeleton variant="list-row" count={2} />
            ) : clubsError ? (
              <p className="text-[13px] text-[var(--muted)] text-center py-6">Couldn't load your clubs. Try again.</p>
            ) : clubs && clubs.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {clubs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!!postingId}
                    onClick={() => shareToClub(c)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl text-left active:bg-[var(--surface-2)] disabled:opacity-50"
                  >
                    <Avatar src={c.coverImageUrl} name={c.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-[var(--ink)] truncate">{c.name}</span>
                      <span className="block text-[12px] text-[var(--muted)]">{c.memberCount} member{c.memberCount === 1 ? '' : 's'}</span>
                    </span>
                    <span className="shrink-0 text-[var(--primary)]">
                      <Icon name={postingId === c.id ? 'spinner' : 'send'} size={18} className={postingId === c.id ? 'animate-spin' : undefined} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[13px] text-[var(--muted)] mb-3">You're not in any clubs yet.</p>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onNavigate('clubs'); }}
                    className="text-[14px] font-bold text-[var(--primary)] active:opacity-70"
                  >
                    Browse clubs
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
      <Toast message={toast.message} show={toast.show} />
    </>
  );
}
