import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { FormField } from '../../shared/components/forms/FormField';
import { useForm } from '../../shared/hooks/useForm';
import { resetPassword, ApiError } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface ResetPasswordScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** Pre-filled reset token (from the forgot-password API response in dev mode). */
  token?: string;
}

export function ResetPasswordScreen({ onNavigate, onBack, token: prefilledToken }: ResetPasswordScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm({
    initial: { token: prefilledToken ?? '', password: '', confirm: '' },
    validators: {
      token: (v) => (!v ? 'Reset code is required' : null),
      password: (v) => (!v ? 'Enter a new password' : v.length < 6 ? 'At least 6 characters' : null),
      confirm: (v, all) => (!v ? 'Confirm your password' : v !== all.password ? "Passwords don't match" : null),
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    form.setTouched('token');
    form.setTouched('password');
    form.setTouched('confirm');
    if (!form.isValid) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(form.values.token.trim(), form.values.password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_TOKEN') {
          setError('This reset link is invalid or has expired. Please request a new one.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-[var(--bg)] px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--lime)] flex items-center justify-center mb-5">
          <Icon name="check" size={28} filled />
        </div>
        <h1 className="text-[20px] font-heading font-bold text-[var(--ink)] mb-2">Password reset</h1>
        <p className="text-[14px] text-[var(--muted)] max-w-[280px] mb-8">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Button onClick={() => onNavigate('login')}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-[var(--bg)] px-6 py-12">
      <div className="w-14 h-14 rounded-full bg-[var(--lime)] flex items-center justify-center mb-5">
        <Icon name="lock" size={28} />
      </div>

      <h1 className="text-[20px] font-heading font-bold text-[var(--ink)] mb-2 text-center">Reset password</h1>
      <p className="text-[14px] text-[var(--muted)] mb-8 text-center max-w-[300px]">
        Enter the reset code from your email and choose a new password.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
        {!prefilledToken && (
          <div className="field">
            <FormField
              label="Reset code"
              placeholder="Paste the code from your email"
              autoComplete="off"
              value={form.values.token}
              onChange={(e) => form.setField('token', e.target.value)}
              onBlur={() => form.setTouched('token')}
              error={form.touched.token ? form.errors.token : undefined}
            />
          </div>
        )}

        <div className="field">
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={form.values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            onBlur={() => form.setTouched('password')}
            error={form.touched.password ? form.errors.password : undefined}
          />
        </div>

        <div className="field">
          <FormField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={form.values.confirm}
            onChange={(e) => form.setField('confirm', e.target.value)}
            onBlur={() => form.setTouched('confirm')}
            error={form.touched.confirm ? form.errors.confirm : undefined}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)] mt-4">
            <span className="flex-none w-5 h-5 rounded-full bg-[var(--coral)] text-white font-heading text-[13px] leading-none flex items-center justify-center">!</span>
            {error}
          </div>
        )}

        <div className="mt-6">
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <button type="button" onClick={onBack} className="text-[13px] font-bold text-[var(--primary)]">
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
