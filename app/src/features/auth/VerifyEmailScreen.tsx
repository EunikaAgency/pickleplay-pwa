import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { verifyEmail, resendVerification, ApiError } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

interface VerifyEmailScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** The verification token from the emailed link (`/verify-email?token=…`). */
  token?: string;
}

type Phase = 'verifying' | 'success' | 'error' | 'no-token';

/** Shared centered card layout for every phase of the screen. Module-level so
 *  it isn't re-created each render (react-hooks/static-components). */
function Shell({ icon, iconColor, title, children }: { icon: string; iconColor: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-[var(--bg)] px-6 py-12 text-center">
      <div className={`w-14 h-14 rounded-full ${iconColor} flex items-center justify-center mb-5`}>
        <Icon name={icon} size={28} filled />
      </div>
      <h1 className="text-[20px] font-heading font-bold text-[var(--ink)] mb-2">{title}</h1>
      {children}
    </div>
  );
}

export function VerifyEmailScreen({ onNavigate, onBack, token }: VerifyEmailScreenProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'no-token');
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  // A verify link can render twice under StrictMode / re-mounts; the token is
  // single-use, so a second POST would 400. Guard so we only attempt it once.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        await verifyEmail(token);
        setPhase('success');
        // Refresh the session so the "verify your email" nudge clears immediately.
        if (useAuthStore.getState().isLoggedIn) void useAuthStore.getState().restore();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'INVALID_TOKEN') {
          setError('This verification link is invalid or has expired. Request a new one below.');
        } else {
          setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        }
        setPhase('error');
      }
    })();
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      await resendVerification();
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (phase === 'verifying') {
    return (
      <Shell icon="mail" iconColor="bg-[var(--lime)]" title="Verifying your email…">
        <p className="text-[14px] text-[var(--muted)] max-w-[280px]">Hang tight, this only takes a moment.</p>
      </Shell>
    );
  }

  if (phase === 'success') {
    return (
      <Shell icon="check" iconColor="bg-[var(--lime)]" title="Email verified">
        <p className="text-[14px] text-[var(--muted)] max-w-[280px] mb-8">
          Thanks — your email is confirmed. You're all set.
        </p>
        <Button onClick={() => onNavigate(isLoggedIn ? 'home' : 'login')}>
          {isLoggedIn ? 'Continue' : 'Sign in'}
        </Button>
      </Shell>
    );
  }

  // 'error' or 'no-token' — offer a resend (only possible while signed in) and a
  // way back. A signed-out user must sign in first to re-request the email.
  const title = phase === 'error' ? 'Verification failed' : 'Verify your email';
  const body = phase === 'error'
    ? (error ?? 'This verification link is invalid or has expired.')
    : "We've sent a verification link to your email. Open it to confirm your address.";

  return (
    <Shell icon={phase === 'error' ? 'error' : 'mail'} iconColor={phase === 'error' ? 'bg-[var(--coral-soft)]' : 'bg-[var(--lime)]'} title={title}>
      <p className="text-[14px] text-[var(--muted)] max-w-[300px] mb-8">{body}</p>

      {resent && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-[var(--lime-soft,var(--lime))] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] mb-4 max-w-[320px]">
          <Icon name="check" size={16} filled />
          Verification email sent — check your inbox.
        </div>
      )}

      {error && phase !== 'error' && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)] mb-4 max-w-[320px]">
          <span className="flex-none w-5 h-5 rounded-full bg-[var(--coral)] text-white font-heading text-[13px] leading-none flex items-center justify-center">!</span>
          {error}
        </div>
      )}

      <div className="w-full max-w-[320px] flex flex-col gap-3">
        {isLoggedIn ? (
          <Button fullWidth onClick={handleResend} disabled={resending || resent}>
            {resending ? 'Sending…' : resent ? 'Email sent' : 'Resend verification email'}
          </Button>
        ) : (
          <Button fullWidth onClick={() => onNavigate('login')}>Sign in to resend</Button>
        )}
        <button type="button" onClick={onBack} className="text-[13px] font-bold text-[var(--primary)]">
          {isLoggedIn ? 'Back' : 'Back to sign in'}
        </button>
      </div>
    </Shell>
  );
}
