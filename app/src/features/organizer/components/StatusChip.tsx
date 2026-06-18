import type { Chip } from '../organizerDisplay';

/** Renders a status pill from a `{ label, className }` chip descriptor
 *  (see organizerDisplay's tournamentStatusChip / regStatusChip). */
export function StatusChip({ chip, className = '' }: { chip: Chip; className?: string }) {
  return (
    <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className} ${className}`}>
      {chip.label}
    </span>
  );
}
