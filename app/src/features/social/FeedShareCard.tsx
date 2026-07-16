import { Icon } from '../../shared/components/ui/Icon';
import { apiImageUrl, type FeedAttachment } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface FeedShareCardProps {
  attachment: FeedAttachment;
  onNavigate: Navigate;
  /** Slightly denser card for the reposted-quote / comment context. */
  compact?: boolean;
}

function spotsBadge(left: number): { label: string; tone: 'green' | 'orange' | 'red' } {
  if (left <= 0) return { label: 'Full', tone: 'red' };
  if (left === 1) return { label: '1 spot left', tone: 'red' };
  if (left <= 3) return { label: `${left} spots left`, tone: 'orange' };
  return { label: `${left} spots left`, tone: 'green' };
}

const toneColors: Record<string, string> = {
  green: 'bg-[var(--lime)]/20 text-[var(--lime-ink)]',
  orange: 'bg-amber-100 text-amber-800',
  red: 'bg-[var(--coral)]/15 text-[var(--coral)]',
};

/**
 * A tappable share card for a PickleFeed post — a public game, an open-play
 * session, or a club. Mirrors the club feed's GameShareCard look, but handles
 * all three entity types and routes to the right detail screen (where the
 * viewer can then join). Card fields are server-enriched snapshots.
 */
export function FeedShareCard({ attachment: a, onNavigate, compact }: FeedShareCardProps) {
  const img = a.imageUrl ? apiImageUrl(a.imageUrl) : '';
  const isClub = a.type === 'club';
  const badge = !isClub && a.spotsLeft != null ? spotsBadge(a.spotsLeft) : null;
  const isFull = !isClub && a.spotsLeft != null && a.spotsLeft <= 0;

  const open = () => {
    if (a.type === 'game') onNavigate('game-details', { id: a.refId });
    else if (a.type === 'open_play') onNavigate('open-play-detail', { source: 'auto', id: a.refId });
    else onNavigate('club-details', { id: a.refId });
  };

  const typeChip = isClub ? 'Club' : a.gameType || (a.type === 'open_play' ? 'Open Play' : 'Game');
  const cta = isClub ? 'View Club' : isFull ? 'View Game' : a.type === 'open_play' ? 'View Open Play' : 'Join Game';

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(); }}
      className={`${compact ? 'mt-2' : 'mt-3'} w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden active:scale-[0.985] transition-transform duration-150`}
    >
      {img && !compact && (
        <div className="w-full h-[140px] bg-[var(--surface-2)] overflow-hidden">
          <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`${compact ? 'p-3 gap-2' : 'p-4 gap-3'} flex flex-col`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink)]">
            <Icon name={isClub ? 'groups' : 'sports_tennis'} size={13} />
            {typeChip}
          </span>
          {badge && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.04em] ${toneColors[badge.tone]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.tone === 'green' ? 'bg-[var(--lime)]' : badge.tone === 'orange' ? 'bg-amber-500' : 'bg-[var(--coral)]'}`} />
              {badge.label}
            </span>
          )}
        </div>

        <h3 className={`font-heading font-bold ${compact ? 'text-[16px]' : 'text-[18px]'} text-[var(--ink)] leading-tight tracking-[-0.01em]`}>
          {a.title || (isClub ? 'Club' : 'Pickleball game')}
        </h3>

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
            </div>
          )}
          {isClub && a.memberCount != null && (
            <div className="flex items-center gap-2.5 text-[14px]">
              <Icon name="groups" size={16} className="text-[var(--muted)] shrink-0" />
              <span className="text-[var(--muted)]">{a.memberCount} member{a.memberCount === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        {!a.dateTime && !a.venue && !a.skillLabel && !(isClub && a.memberCount != null) && a.subtitle && (
          <p className="text-[14px] text-[var(--muted)] leading-snug line-clamp-2">{a.subtitle}</p>
        )}

        <div className="mt-1">
          <span className={`block w-full text-center py-3 rounded-xl text-[15px] font-bold active:opacity-80 transition-opacity ${isFull ? 'bg-[var(--surface-2)] text-[var(--muted)]' : 'bg-[var(--lime)] text-[var(--ink)]'}`}>
            {cta}
          </span>
        </div>
      </div>
    </button>
  );
}
