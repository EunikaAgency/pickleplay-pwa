import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ShareLobbySheet } from '../../shared/components/ui/ShareLobbySheet';
import { deleteGame, apiImageUrl, type ApiGame } from '../../shared/lib/api';
import { gameTitle, gameLocation, gameTypeLabel, dayParts, timeLine, spotsLabel } from './gameDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface GameManageActionsProps {
  game: ApiGame;
  onNavigate: Navigate;
  /** Called after a successful delete so the parent can drop it from its list. */
  onDeleted: (id: string) => void;
  className?: string;
}

// A game can be edited only while still filling; deleted only before it books a court.
const EDITABLE = new Set(['published', 'full']);
const UNDELETABLE = new Set(['booked', 'paying']);

/** Host-only Edit / Delete row for a game the current user created. Shared by
 *  MyGamesScreen and the Games tab's "My Games" list. */
export function GameManageActions({ game, onNavigate, onDeleted, className = '' }: GameManageActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const canEdit = EDITABLE.has(game.status ?? '');
  const canDelete = !UNDELETABLE.has(game.status ?? '');

  const doDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteGame(game.id);
      onDeleted(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this game.');
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Delete this game?</span>
          <div className="flex items-center gap-2">
            <button className="text-[13px] font-bold text-[var(--muted)] px-2" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </button>
            <button
              className="text-[13px] font-bold text-white bg-[var(--coral)] rounded-full px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting
                ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={13} /></span> Deleting…</>
                : 'Delete'}
            </button>
          </div>
        </div>
        {error && <div className="text-[12px] text-[var(--coral)] font-semibold mt-1.5">{error}</div>}
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-4 ${className}`}>
        <button className="text-[13px] font-bold text-[var(--primary)] flex items-center gap-1" onClick={() => setShareOpen(true)}>
          <Icon name="share" size={14} /> Share
        </button>
        {canEdit && (
          <button className="text-[13px] font-bold text-[var(--primary)] flex items-center gap-1" onClick={() => onNavigate('edit-game', { id: game.id })}>
            <Icon name="edit" size={14} /> Edit
          </button>
        )}
        {canDelete ? (
          <button className="text-[13px] font-bold text-[var(--coral)] flex items-center gap-1" onClick={() => { setError(null); setConfirming(true); }}>
            <Icon name="close" size={14} /> Delete
          </button>
        ) : (
          <span className="text-[12px] font-semibold text-[var(--muted)] flex items-center gap-1">
            <Icon name="lock" size={13} /> Booked — cancel the booking to remove
          </span>
        )}
      </div>

      <ShareLobbySheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        gameId={game.id}
        title={gameTitle(game)}
        subtitle={[timeLine(game), gameLocation(game), spotsLabel(game)].filter(Boolean).join(' · ')}
        image={apiImageUrl(game.courtImage) || apiImageUrl(game.venue?.image) || ''}
        gameType={gameTypeLabel(game)}
        skillLabel={game.skillLabel ?? undefined}
        dateTime={[dayParts(game).day === 'TODAY' ? 'Today' : dayParts(game).day === 'TOM' ? 'Tomorrow' : dayParts(game).day, timeLine(game)].filter(Boolean).join(' · ') || undefined}
        venue={gameLocation(game)}
        spotsLeft={game.spotsLeft ?? undefined}
        capacity={game.capacity ?? undefined}
        onNavigate={onNavigate}
      />
    </>
  );
}
