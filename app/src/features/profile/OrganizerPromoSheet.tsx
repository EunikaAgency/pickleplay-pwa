import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { Icon } from '../../shared/components/ui/Icon';

/** What the paid organizer subscription unlocks. Mirrors the list on the
 *  subscribe screen (`ORGANIZER_BENEFITS` in CoachSubscribeScreen) — keep the
 *  two in step. */
const ORGANIZER_BENEFITS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: 'payments',
    title: 'Charge for Open Play',
    body: 'Run paid Open Play sessions and keep every peso you collect.',
  },
  {
    icon: 'stadium',
    title: 'Organize at any venue',
    body: 'Apply to the venues you want. The owner approves you, then you can run sessions there.',
  },
  {
    icon: 'emoji_events',
    title: 'Run tournaments & events',
    body: 'Host tournaments, one-off events and recurring open play from the organizer console.',
  },
  {
    icon: 'verified',
    title: 'An Organizer badge on your profile',
    body: 'Shown to everyone who visits your public profile, for as long as your plan is active.',
  },
];

interface OrganizerPromoSheetProps {
  open: boolean;
  onClose: () => void;
  /** Opens the real subscribe screen (address gate + payment live there). */
  onContinue: () => void;
  price: number | null;
  durationDays: number | null;
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

export function OrganizerPromoSheet({ open, onClose, onContinue, price, durationDays }: OrganizerPromoSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Organize on PickleBallers"
      subtitle="Run the community and earn from it. Here's what a subscription unlocks."
      footer={
        <Button fullWidth onClick={onContinue}>
          {price != null ? `Continue · ${peso(price)}` : 'Continue'}
        </Button>
      }
    >
      {/* 20px sides to line up with `.sheet-head` (padding: 8px 20px) and the
          footer's px-5 — `.sheet-body` itself has no horizontal padding. */}
      <div className="px-5 pb-5">
        {price != null && (
          <div className="mb-5 flex items-baseline gap-1.5 rounded-2xl bg-[var(--surface-2)] px-4 py-3.5">
            <span className="font-heading text-[30px] font-extrabold leading-none">{peso(price)}</span>
            <span className="text-[13px] text-[var(--muted)]">/ {durationDays ?? 30} days</span>
          </div>
        )}

        <ul className="flex flex-col gap-4">
          {ORGANIZER_BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--lime)] text-[var(--lime-ink)]">
                <Icon name={b.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold">{b.title}</span>
                <span className="block text-[12.5px] leading-snug text-[var(--muted)]">{b.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 border-t border-[var(--hairline)] pt-4 text-[12px] leading-snug text-[var(--muted)]">
          Cancel any time — you keep the days you already paid for. You&apos;ll need a
          complete address on your profile before you can subscribe.
        </p>
      </div>
    </BottomSheet>
  );
}
