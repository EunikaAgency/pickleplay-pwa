import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { resendVerification, ApiError } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

const DISMISS_KEY = 'pb-verify-banner-dismissed';

interface VerifyEmailBannerProps {
  onNavigate: Navigate;
}

/**
 * A slim nudge shown to signed-in users who haven't confirmed their email. An
 * unverified (often typo'd) address silently breaks password reset later — the
 * link would go to an address the user doesn't own — so we surface it early with
 * a one-tap resend. Dismissal is per-session (sessionStorage) so it stays gentle
 * but returns next visit until the email is actually verified.
 */
export function VerifyEmailBanner({ onNavigate }: VerifyEmailBannerProps) {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Only for signed-in, unverified accounts. `isVerified === undefined` (an older
  // cached session) is treated as verified so we never nag on stale data.
  if (!isLoggedIn || !user || user.isVerified !== false || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const resend = async () => {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch (err) {
      setState('error');
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') onNavigate('login');
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--lime)] text-[var(--ink)]">
      <Icon name="mark_email_unread" size={20} filled />
      <div className="flex-1 min-w-0 text-[12.5px] font-semibold leading-tight">
        {state === 'sent'
          ? 'Verification email sent — check your inbox.'
          : state === 'error'
            ? "Couldn't send the email. Try again in a moment."
            : 'Verify your email so you never lose access to your account.'}
      </div>
      {state !== 'sent' && (
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending'}
          className="flex-none text-[12.5px] font-bold underline underline-offset-2 disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Resend'}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex-none opacity-70 hover:opacity-100">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
