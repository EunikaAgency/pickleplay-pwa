/** A status pill built from a `{ label, className }` descriptor.
 *
 *  Several modules produce those descriptors — `bookingDisplay`'s
 *  `bookingPhaseChip` / `statusChip`, `organizerDisplay`'s
 *  `tournamentStatusChip` / `regStatusChip` — and they're structurally
 *  identical, so one component renders them all. Lives here rather than under
 *  `features/organizer/` because bookings and the owner inbox use it too. */
export interface ChipDescriptor {
  label: string;
  className: string;
}

export function StatusChip({ chip, className = '' }: { chip: ChipDescriptor; className?: string }) {
  return (
    <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className} ${className}`}>
      {chip.label}
    </span>
  );
}
