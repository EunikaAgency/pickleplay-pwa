import { Icon } from './Icon';
import { apiImageUrl, type ClubAttachment } from '../../lib/api';
import type { Navigate } from '../../lib/navigation';

interface GameShareCardProps {
  attachment: ClubAttachment & { type: 'game_link' };
  onNavigate: Navigate;
}

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

/**
 * Facebook / Airbnb-style rich game share card for club feeds.
 *
 * Designed around a single goal: make the viewer think "there's a game I can
 * join" in under two seconds and give them exactly one obvious action.
 */
export function GameShareCard({ attachment, onNavigate }: GameShareCardProps) {
  const a = attachment;
  const img = a.url ? apiImageUrl(a.url) : '';
  const badge = a.spotsLeft != null ? spotsBadge(a.spotsLeft) : null;
  const isFull = a.spotsLeft != null && a.spotsLeft <= 0;

  return (
    <button
      type="button"
      onClick={() => onNavigate('game-details', { id: a.gameId! })}
      className="mt-3 w-full text-left rounded-2xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden active:scale-[0.985] transition-transform duration-150"
    >
      {/* Optional venue / court image — subtle, never dominates */}
      {img && (
        <div className="w-full h-[140px] bg-[var(--surface-2)] overflow-hidden">
          <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* ── Top row: game type chip + spots badge ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {a.gameType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink)]">
              <Icon
                name={a.gameType === 'Singles' ? 'person' : a.gameType === 'Doubles' ? 'groups' : 'sports_tennis'}
                size={13}
              />
              {a.gameType}
            </span>
          )}
          {badge && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.04em] ${toneColors[badge.tone]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.tone === 'green' ? 'bg-[var(--lime)]' : badge.tone === 'orange' ? 'bg-amber-500' : 'bg-[var(--coral)]'}`} />
              {badge.label}
            </span>
          )}
        </div>

        {/* ── Title ── */}
        <h3 className="font-heading font-bold text-[18px] text-[var(--ink)] leading-tight tracking-[-0.01em]">
          {a.title || 'Pickleball game'}
        </h3>

        {/* ── Info rows ── */}
        <div className="flex flex-col gap-2">
          {a.dateTime && (
            <div className="flex items-center gap-2.5 text-[14px]">
              <Icon name="clock" size={16} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--ink)] font-medium">{a.dateTime}</span>
            </div>
          )}
          {a.venue && (
            <div className="flex items-center gap-2.5 text-[14px]">
              <Icon name="location" size={16} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--muted)] truncate">{a.venue}</span>
            </div>
          )}
          {a.skillLabel && (
            <div className="flex items-center gap-2.5 text-[14px]">
              <Icon name="paddle" size={16} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--muted)]">{a.skillLabel}</span>
              {a.capacity != null && a.spotsLeft != null && (
                <span className="text-[var(--hairline)]">·</span>
              )}
              {a.capacity != null && a.spotsLeft != null && (
                <span className="text-[var(--muted)] text-[13px]">
                  {a.capacity - a.spotsLeft}/{a.capacity} joined
                </span>
              )}
            </div>
          )}
        </div>

        {/* If no structured fields, fall back to subtitle */}
        {!a.dateTime && !a.venue && !a.skillLabel && a.subtitle && (
          <p className="text-[14px] text-[var(--muted)] leading-snug">{a.subtitle}</p>
        )}

        {/* ── CTA ── */}
        <div className="mt-1">
          <span
            className={`block w-full text-center py-3 rounded-xl text-[15px] font-bold active:opacity-80 transition-opacity ${
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
