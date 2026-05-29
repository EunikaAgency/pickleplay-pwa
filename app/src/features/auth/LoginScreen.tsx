import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { FormField } from '../../shared/components/forms/FormField';
import { useForm } from '../../shared/hooks/useForm';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onBack?: () => void;
}

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initial: { email: 'alex@example.com', password: 'password123' },
    validators: {
      email: (v) =>
        !v ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) ? 'Enter a valid email.' : undefined,
      password: (v) => (!v ? 'Password is required.' : (v as string).length < 6 ? 'At least 6 characters.' : undefined),
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.isValid) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div className="scroll flex flex-col pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))] bg-[radial-gradient(900px_500px_at_10%_-10%,rgba(0,64,224,0.18),transparent_60%),radial-gradient(600px_400px_at_100%_110%,rgba(193,241,0,0.25),transparent_60%),var(--bg)]">
      {onBack && (
        <div className="px-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--muted)]"
          >
            <Icon name="back" size={14} />
            Back
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center py-6">
      <div className="px-5 pt-6 pb-2 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-[var(--lime)] text-[var(--lime-ink)] mx-auto mb-3.5 flex items-center justify-center shadow-[var(--shadow-fab)]">
          <Icon name="paddle" size={32} />
        </div>
        <h1 className="hd-1 mt-0">PickleBallers</h1>
        <p className="t-sm mt-2">Find games. Meet players. Play pickleball.</p>
      </div>

      <div className="mx-4 mt-5 rounded-3xl p-5 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]">
        <div className="p-5">
          <h2 className="hd-2">Welcome back</h2>
          <p className="t-sm mt-1">Ready to hit the courts?</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <FormField
              label="Email"
              type="email"
              value={form.values.email}
              onChange={(e) => form.setField('email', e.target.value)}
              onBlur={() => form.setTouched('email')}
              placeholder="you@example.com"
              leadingIcon="mail"
              error={form.touched.email ? form.errors.email : undefined}
            />
          </div>

          <div className="field">
            <FormField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.values.password}
              onChange={(e) => form.setField('password', e.target.value)}
              onBlur={() => form.setTouched('password')}
              placeholder="••••••••"
              leadingIcon="lock"
              error={form.touched.password ? form.errors.password : undefined}
              trailingSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-[var(--muted)]"
                >
                  <Icon name={showPassword ? 'heart' : 'heart_o'} size={16} />
                </button>
              }
            />
          </div>

          <div className="flex justify-end px-5">
            <a href="#" className="text-[12px] font-bold text-[var(--primary)]">
              Forgot password?
            </a>
          </div>

          <div className="px-5 mt-4">
            <Button type="submit" fullWidth disabled={loading || !form.isValid}>
              {loading ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={18} />
                  </span>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in <Icon name="forward" size={16} />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="px-5 pt-5 pb-3 text-center">
          <p className="t-sm">
            New here?{' '}
            <a href="#" className="text-[var(--primary)] font-bold">
              Join the league
            </a>
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-[18px] opacity-70">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
          <Icon name="shield" size={12} /> SECURE
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
          <Icon name="groups" size={12} /> 10K+ PLAYERS
        </span>
      </div>
      </div>
    </div>
  );
}
