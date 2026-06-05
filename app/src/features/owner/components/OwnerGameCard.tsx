import { Icon } from '../../../shared/components/ui/Icon';
import type { OwnerGameRow } from '../hooks/useOwnerDashboard';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const THUMB = ['var(--lime)', 'var(--primary)', 'var(--coral)'];

function thumbColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % THUMB.length;
  return THUMB[h];
}
function dayParts(date?: string | null): { day: string; num: string } {
  if (!date) return { day: 'SOON', num: '' };
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: 'SOON', num: '' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return { day: diff === 0 ? 'TODAY' : diff === 1 ? 'TOM' : WD[d.getDay()], num: String(d.getDate()) };
}
function gameTitle(g: OwnerGameRow): string {
  if (g.title) return g.title;
  const type = g.gameType ? g.gameType.charAt(0).toUpperCase() + g.gameType.slice(1) : 'Open';
  return g.skillLabel ? `${type} · ${g.skillLabel}` : `${type} game`;
}

// A game played at one of the owner's venues — venue-tagged, read-only,
// taps through to the shared game-details screen.
export function OwnerGameCard({ game, onOpen }: { game: OwnerGameRow; onOpen: () => void }) {
  const dp = dayParts(game.date);
  const spots = game.spotsLeft ?? 0;
  const full = spots <= 0;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-[var(--surface)] rounded-[18px] p-3.5 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex items-center gap-3">
      <div className="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center shrink-0 text-white" style={{ background: thumbColor(game.id) }}>
        <span className="text-[9px] font-extrabold leading-none">{dp.day}</span>
        {dp.num && <span className="text-[16px] font-extrabold leading-tight">{dp.num}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-heading font-semibold text-[15px] text-[var(--ink)] truncate">{gameTitle(game)}</div>
        <div className="t-sm truncate flex items-center gap-1">
          <Icon name="location" size={12} /> {game.venueName}{game.timeLabel ? ` · ${game.timeLabel}` : ''}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[12px] font-bold ${full ? 'text-[var(--coral)]' : 'text-[var(--primary)]'}`}>{full ? 'Full' : `${spots} left`}</div>
        <div className="t-sm tabular-nums">{game.participantCount ?? 0}/{game.capacity ?? 0}</div>
      </div>
    </button>
  );
}
