import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { FormField } from '../../shared/components/forms/FormField';
import { FormSelect } from '../../shared/components/forms/FormSelect';
import { useForm } from '../../shared/hooks/useForm';
import { ApiError, type RegisterRole } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { ROLE_META } from '../../shared/lib/roleDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onBack?: () => void;
  onNavigate: Navigate;
}

// Roles a new account can pick at sign-up. Mirrors the API's REGISTERABLE_ROLES
// (player/owner/organizer/coach); admin/moderator are assigned by an admin only.
const ROLE_OPTIONS: { value: RegisterRole; label: string; icon: string; iconColor: string }[] = [
  { value: 'player',    label: 'Player',    icon: 'paddle',   iconColor: ROLE_META.player.color },
  { value: 'owner',     label: 'Owner',     icon: 'location', iconColor: ROLE_META.owner.color },
  { value: 'organizer', label: 'Organizer', icon: 'trophy',   iconColor: ROLE_META.organizer.color },
  { value: 'coach',     label: 'Coach',     icon: 'star',     iconColor: ROLE_META.coach.color },
];

// Dev-only one-tap logins, one per role, so any role's surfaces can be reviewed
// fast. Seeded emails (password123) except admin; re-running the user seed
// regenerates the random ones — refresh these from web/TEST_CREDENTIALS.txt.
const TEST_ACCOUNTS: { label: string; email: string; password: string }[] = [
  { label: 'Player 1',    email: '05fd2f8f.wang@example.com',        password: 'password123' },
  { label: 'Player 2',    email: '0c37a4ae.carrasco@example.com',    password: 'password123' },
  { label: 'Owner 1',     email: '037de3f0.gardner@example.com',     password: 'password123' },
  { label: 'Owner 2',     email: '082126c2.miller@example.com',      password: 'password123' },
  { label: 'Organizer 1', email: '1a8a7872.martin@example.com',      password: 'password123' },
  { label: 'Organizer 2', email: '24545751.mckinney@example.com',    password: 'password123' },
];

export function LoginScreen({ onLoginSuccess, onBack, onNavigate }: LoginScreenProps) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RegisterRole>('player');
  const [nameTouched, setNameTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    initial: { email: '', password: '' },
    validators: {
      email: (v) =>
        !v ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) ? 'Enter a valid email.' : undefined,
      password: (v) => (!v ? 'Password is required.' : (v as string).length < 6 ? 'At least 6 characters.' : undefined),
    },
  });

  const signIn = async (email: string, password: string) => {
    if (loading) return;
    setSubmitError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      onLoginSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect email or password.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
      );
      setLoading(false);
    }
  };

  const createAccount = async () => {
    if (loading) return;
    setSubmitError(null);
    setLoading(true);
    try {
      await register({ email: form.values.email.trim(), password: form.values.password, displayName: name.trim(), role });
      onLoginSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && err.status === 409
          ? 'That email is already registered — try signing in.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
      );
      setLoading(false);
    }
  };

  const switchMode = (next: 'signin' | 'register') => {
    setMode(next);
    setSubmitError(null);
    setNameTouched(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      setNameTouched(true);
      if (!name.trim() || !form.isValid) return;
      void createAccount();
    } else {
      if (!form.isValid) return;
      void signIn(form.values.email, form.values.password);
    }
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

      <div className="mx-auto mt-5 w-full max-w-[720px] rounded-3xl p-5 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]">
        <div className="p-5">
          <h2 className="hd-2">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="t-sm mt-1">{mode === 'register' ? 'Join the community in seconds.' : 'Ready to hit the courts?'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field">
              <FormField
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="Your name"
                leadingIcon="user"
                error={nameTouched && !name.trim() ? 'Name is required.' : undefined}
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="field">
              <FormSelect
                label="I'm joining as"
                options={ROLE_OPTIONS}
                value={role}
                onChange={(e) => setRole(e.target.value as RegisterRole)}
              />
            </div>
          )}

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
                  <Icon name={showPassword ? 'eye_off' : 'eye'} size={16} />
                </button>
              }
            />
          </div>

          {mode === 'signin' && (
            <div className="flex justify-end px-5">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-[12px] font-bold text-[var(--primary)]"
              >
                Forgot password?
              </button>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]"
            >
              <span className="flex-none w-5 h-5 rounded-full bg-[var(--coral)] text-white font-heading text-[13px] leading-none flex items-center justify-center">
                !
              </span>
              {submitError}
            </div>
          )}

          <div className="px-5 mt-4">
            <Button type="submit" fullWidth disabled={loading || !form.isValid || (mode === 'register' && !name.trim())}>
              {loading ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={18} />
                  </span>
                  {mode === 'register' ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {mode === 'register' ? 'Create account' : 'Sign in'} <Icon name="forward" size={16} />
                </>
              )}
            </Button>
          </div>

          {mode === 'signin' && (
            <div className="px-5 mt-3">
              <div className="t-eyebrow mb-1.5 text-center">Quick test login</div>
              <div className="flex flex-wrap justify-center gap-2">
                {TEST_ACCOUNTS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={loading}
                    onClick={() => signIn(a.email, a.password)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-[0.5px] border-dashed border-[var(--hairline)] px-3 py-2.5 text-[12px] font-bold text-[var(--muted)] disabled:opacity-60"
                  >
                    <Icon name="bolt" size={14} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="px-5 pt-5 pb-3 text-center">
          <p className="t-sm">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button type="button" onClick={() => switchMode('register')} className="text-[var(--primary)] font-bold">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="text-[var(--primary)] font-bold">
                  Sign in
                </button>
              </>
            )}
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
