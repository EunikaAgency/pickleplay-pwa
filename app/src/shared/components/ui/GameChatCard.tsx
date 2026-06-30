import { Icon } from './Icon';
import { apiImageUrl } from '../../lib/api';
import type { Navigate } from '../../lib/navigation';
import type { ChatCardData } from './ChatThread';

function spotsBadge(left: number): { label: string; tone: 'green' | 'orange' | 'red' } {
  if (left <= 0) return { label: 'Full', tone: 'red' };
  if (left === 1) return { label: '1 spot left', tone: 'red' };
  if (left <= 3) return { label: `${left} spots left`, tone: 'orange' };
  return { label: `${left} spots left`, tone: 'green' };
}

const toneColors: Record<string, string> = {
  green:  'bg-[var(--lime)]/20 text-[var(--lime-ink)]',
  orange: 'bg-amber-100 text-amber-800',
  red:    'bg-[var(--coral)]/15 text-[var(--coral)]',
};
const toneDot: Record<string, string> = {
  green:  'bg-[var(--lime)]',
  orange: 'bg-amber-500',
  red:    'bg-[var(--coral)]',
};

/**
 * An invitation-style game card rendered in a club chat — visually distinct
 * from a plain text message. Mirrors GameShareCard's surface styling (rounded,
 * bordered, shadowed) so it reads as a shared invitation the recipient can act
 * on, not as inline chat text.
 *
 * Rendered OUTSIDE the message bubble by ChatThreadBody so there's clear
 * visual separation between the chat message and the invitation card.
 */
export function GameChatCard({
  card,
  onNavigate,
  suppress,
}: {
  card: ChatCardData;
  onNavigate?: Navigate;
  /** When true, tap does nothing (a context menu is open). */
  suppress?: boolean;
}) {
  const img = card.imageUrl ? apiImageUrl(card.imageUrl) : '';
  const badge = card.spotsLeft != null ? spotsBadge(card.spotsLeft) : null;
  const isFull = card.spotsLeft != null && card.spotsLeft <= 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (suppress) return;
        if (onNavigate) onNavigate('game-details', { id: card.gameId });
      }}
      className="w-full text-left rounded-2xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden active:scale-[0.985] transition-transform duration-150"
    >
      {/* Venue / court image — subtle hero strip */}
      {img && (
        <div className="w-full h-[120px] bg-[var(--surface-2)] overflow-hidden">
          <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3.5 flex flex-col gap-2.5">
        {/* ── Top row: game type + spots badge ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {card.gameType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink)]">
              <Icon
                name={card.gameType === 'Singles' ? 'person' : card.gameType === 'Doubles' ? 'groups' : 'sports_tennis'}
                size={12}
              />
              {card.gameType}
            </span>
          )}
          {badge && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.04em] ${toneColors[badge.tone]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${toneDot[badge.tone]}`} />
              {badge.label}
            </span>
          )}
        </div>

        {/* ── Title ── */}
        <h3 className="font-heading font-bold text-[16px] text-[var(--ink)] leading-tight tracking-[-0.01em]">
          {card.title || 'Pickleball game'}
        </h3>

        {/* ── Info rows ── */}
        <div className="flex flex-col gap-1.5">
          {card.dateTime && (
            <div className="flex items-center gap-2 text-[13px]">
              <Icon name="clock" size={15} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--ink)] font-medium">{card.dateTime}</span>
            </div>
          )}
          {card.venue && (
            <div className="flex items-center gap-2 text-[13px]">
              <Icon name="location" size={15} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--muted)] truncate">{card.venue}</span>
            </div>
          )}
          {card.skillLabel && (
            <div className="flex items-center gap-2 text-[13px]">
              <Icon name="paddle" size={15} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--muted)]">{card.skillLabel}</span>
              {card.capacity != null && card.spotsLeft != null && (
                <>
                  <span className="text-[var(--hairline)]">·</span>
                  <span className="text-[var(--muted)] text-[12px]">
                    {card.capacity - card.spotsLeft}/{card.capacity} joined
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fallback subtitle when no structured fields */}
        {!card.dateTime && !card.venue && !card.skillLabel && card.subtitle && (
          <p className="text-[13px] text-[var(--muted)] leading-snug">{card.subtitle}</p>
        )}

        {/* ── CTA ── */}
        <div className="mt-0.5">
          <span
            className={`block w-full text-center py-2.5 rounded-xl text-[14px] font-bold active:opacity-80 transition-opacity ${
              isFull
                ? 'bg-[var(--surface-2)] text-[var(--muted)]'
                : 'bg-[var(--lime)] text-[var(--ink)]'
            }`}
          >
            {isFull ? 'View Game' : 'Join Game'}
          </span>
        </div>
      </div>
    </button>
  );
}
