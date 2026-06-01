import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';

interface AuthPromptSheetProps {
  open: boolean;
  /** Verb phrase describing the gated action, e.g. "join this game". */
  intent: string;
  onClose: () => void;
  /** Continue to the sign-up / sign-in flow. */
  onContinue: () => void;
}

const PERKS = [
  { icon: 'bolt', label: 'Join games and lock in your spot' },
  { icon: 'plus', label: 'Create matches and start clubs' },
  { icon: 'trophy', label: 'Track your matches and streaks' },
];

/**
 * Soft auth gate. Guests can browse the whole app; the first time they try a
 * commit action (join / create / find a match) we surface this sheet inviting
 * them to create a free account instead of blocking silently.
 */
export function AuthPromptSheet({ open, intent, onClose, onContinue }: AuthPromptSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Create your free account"
      subtitle={`You'll need an account to ${intent}. Browsing stays free — sign up takes a few seconds.`}
    >
      <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <ul className="space-y-3 mt-1 mb-5">
          {PERKS.map((p) => (
            <li key={p.label} className="flex items-center gap-3 text-[14px] text-[var(--ink)]">
              <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center shrink-0">
                <Icon name={p.icon} size={16} />
              </span>
              {p.label}
            </li>
          ))}
        </ul>
        <Button fullWidth onClick={onContinue}>
          Create free account
        </Button>
        <button
          type="button"
          onClick={onContinue}
          className="w-full mt-2.5 py-2 text-[14px] font-bold text-[var(--primary)]"
        >
          I already have an account
        </button>
      </div>
    </BottomSheet>
  );
}
