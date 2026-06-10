import type { ApiCourt } from '../../lib/api';

interface CourtPickerProps {
  courts: ApiCourt[];
  /** Selected court id, or '' for none. */
  value: string;
  onChange: (courtId: string) => void;
}

/** Human label for a court: its name, else "Court <number>". */
function courtLabel(court: ApiCourt): string {
  if (court.courtName && court.courtName.trim()) return court.courtName.trim();
  return `Court ${court.courtNumber}`;
}

/** A court's surface/indoor sub-line, e.g. "Indoor · Hard" — omitted when empty. */
function courtMeta(court: ApiCourt): string {
  const io = court.indoor == null ? '' : court.indoor ? 'Indoor' : 'Outdoor';
  return [io, court.surfaceType || ''].filter(Boolean).join(' · ');
}

/**
 * Pick which court to book. Each court is reserved independently, so the chosen
 * court drives both the time picker's availability and the booking it creates.
 * Presentational: the screen owns fetching the venue's courts and the selection.
 */
export function CourtPicker({ courts, value, onChange }: CourtPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose a court">
      {courts.map((court) => {
        const sel = court.id === value;
        const meta = courtMeta(court);
        return (
          <button
            key={court.id}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(court.id)}
            className={`time-pick !py-2.5 flex flex-col items-center gap-0.5 ${sel ? 'active' : ''}`}
          >
            <span className="truncate max-w-full">{courtLabel(court)}</span>
            {meta && (
              <span className={`text-[11px] font-semibold ${sel ? 'text-white/70' : 'text-[var(--muted)]'}`}>{meta}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
