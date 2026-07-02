import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { FormField } from '../../shared/components/forms/FormField';
import { useForm } from '../../shared/hooks/useForm';
import { forgotPassword, ApiError } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface ForgotPasswordScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function ForgotPasswordScreen({ onNavigate, onBack }: ForgotPasswordScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm({
    initial: { email: '' },
    validators: {
      email: (v) => (!v ? 'Email is required' : !/\S+@\S+\.\S+/.test(v) ? 'Enter a valid email' : null),
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    form.setTouched('email');
    if (!form.isValid || !form.values.email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await forgotPassword(form.values.email.trim());
      if (result.token) {
        onNavigate('reset-password', { token: result.token });
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-[var(--bg)] px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--lime)] flex items-center justify-center mb-5">
          <Icon name="mail" size={28} filled />
        </div>
        <h1 className="text-[20px] font-heading font-bold text-[var(--ink)] mb-2">Check your email</h1>
        <p className="text-[14px] text-[var(--muted)] max-w-[280px] mb-8">
          If an account exists for <strong>{form.values.email}</strong>, we've sent a password reset link.
        </p>
        <Button variant="outline" onClick={onBack}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-[var(--bg)] px-6 py-12">
      <div className="w-14 h-14 rounded-full bg-[var(--lime)] flex items-center justify-center mb-5">
        <Icon name="lock" size={28} />
      </div>

      <h1 className="text-[20px] font-heading font-bold text-[var(--ink)] mb-2 text-center">Forgot password</h1>
      <p className="text-[14px] text-[var(--muted)] mb-8 text-center max-w-[300px]">
        Enter the email you signed up with and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
        <FormField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.values.email}
          onChange={(e) => form.setField('email', e.target.value)}
          onBlur={() => form.setTouched('email')}
          error={form.touched.email ? form.errors.email : undefined}
        />

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)] mt-4">
            <span className="flex-none w-5 h-5 rounded-full bg-[var(--coral)] text-white font-heading text-[13px] leading-none flex items-center justify-center">!</span>
            {error}
          </div>
        )}

        <div className="mt-6">
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
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
