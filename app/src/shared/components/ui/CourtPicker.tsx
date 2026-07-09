import { apiImageUrl, type ApiCourt } from '../../lib/api';

interface CourtPickerProps {
  courts: ApiCourt[];
  /** Selected court id, or '' for none. */
  value: string;
  onChange: (courtId: string) => void;
  /** Optional per-court price label (e.g. "₱250/hr"). The owning screen formats
   *  it so this shared control stays free of currency/feature logic. */
  priceFor?: (court: ApiCourt) => string | undefined;
  /** Override the responsive column layout (default "grid-cols-2"). */
  gridClassName?: string;
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
export function CourtPicker({ courts, value, onChange, priceFor, gridClassName = 'grid-cols-2' }: CourtPickerProps) {
  return (
    <div className={`grid ${gridClassName} gap-2`} role="radiogroup" aria-label="Choose a court">
      {courts.map((court) => {
        const sel = court.id === value;
        const meta = courtMeta(court);
        const img = apiImageUrl(court.mainImageUrl);
        return (
          <button
            key={court.id}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(court.id)}
            className={`time-pick !py-2.5 flex flex-col items-center gap-1 ${sel ? 'active' : ''}`}
          >
            {img && (
              <img
                src={img}
                alt=""
                className="mb-0.5 h-20 w-full rounded-lg object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
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
